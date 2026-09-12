import { publicClient, reachAbi } from "./chain.js";
import { config } from "./config.js";
import { getSyncedBlock, setSyncedBlock, insertTransaction, hasReachTransaction, type TransactionRow } from "./db.js";
import { notifyReceiver } from "./notifier.js";

// Arc produces blocks fast, so a deploy from a few hours ago can already be hundreds
// of thousands of blocks back — bigger chunks means fewer requests, which is what
// actually matters against a requests-per-second limit (a smaller range just means
// more requests hitting the same limit sooner).
const CHUNK_SIZE = 20_000n;
const PACE_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function reachLogToRow(log: any): TransactionRow {
  return {
    tx_hash: log.transactionHash,
    log_index: log.logIndex,
    block_number: Number(log.blockNumber),
    sender: log.args.sender.toLowerCase(),
    receiver: log.args.receiver.toLowerCase(),
    token: log.args.token.toLowerCase(),
    gross_amount: log.args.grossAmount.toString(),
    fee: log.args.fee.toString(),
    net_amount: log.args.netAmount.toString(),
    memo: log.args.memo,
    created_at: Date.now(),
    kind: "reach",
  };
}

async function fetchLogs(from: bigint, to: bigint, attempt = 0): Promise<any[]> {
  try {
    return await publicClient.getLogs({
      address: config.reachAddress,
      event: reachAbi[0],
      fromBlock: from,
      toBlock: to,
    });
  } catch (err: any) {
    if (err?.code === -32005 && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      return fetchLogs(from, to, attempt + 1);
    }
    throw err;
  }
}

async function handleLogs(logs: any[]) {
  for (const log of logs) {
    const row = reachLogToRow(log);
    insertTransaction(row);
    notifyReceiver(row.receiver, row.net_amount, row.token).catch((err) =>
      console.error("notify failed", row.tx_hash, err)
    );
  }
}

async function backfill() {
  let from = getSyncedBlock(config.reachDeployBlock);
  const head = await publicClient.getBlockNumber();

  while (from <= head) {
    const to = from + CHUNK_SIZE > head ? head : from + CHUNK_SIZE;
    const logs = await fetchLogs(from, to);
    await handleLogs(logs);
    setSyncedBlock(to);
    from = to + 1n;
    if (from <= head) await sleep(PACE_MS);
  }
}

function watchLive() {
  publicClient.watchContractEvent({
    address: config.reachAddress,
    abi: reachAbi,
    eventName: "RemittanceSent",
    onLogs: (logs) => {
      handleLogs(logs).then(() => {
        const last = logs.at(-1);
        if (last) setSyncedBlock(last.blockNumber);
      });
    },
    // without this, a poll that hits the same rate limit backfill ran into fails
    // silently and the indexer just quietly stops picking up new sends
    onError: (err) => console.error("live watch error", err),
  });
}

interface ExplorerTokenTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  blockNumber: string;
  timeStamp: string;
}

// A history load can fire this more than once in quick succession (React Query
// refetch-on-focus, a user bouncing between tabs) — the explorer's free tier rate
// limits fast, so repeat calls for the same address within this window are skipped
// rather than re-hitting it every time.
const DEPOSIT_SYNC_TTL_MS = 15_000;
const lastSyncedAt = new Map<string, number>();

// Arc's USDC is the chain's native gas token — a plain value-transfer never emits an
// ERC20 Transfer log, so scanning logs can never see it, and USDC's Transfer log
// volume (it backs *every* tx's gas payment) makes chain-wide log scanning
// infeasible regardless. Arc's block explorer already indexes both plain native
// sends and real ERC20 transfers under one address-scoped endpoint, so deposits are
// synced from there instead of from raw RPC logs.
export async function syncDeposits(address: `0x${string}`) {
  const key = address.toLowerCase();
  const last = lastSyncedAt.get(key);
  if (last && Date.now() - last < DEPOSIT_SYNC_TTL_MS) return;
  // set before the request resolves so a 429 also starts the cooldown — otherwise
  // a burst of calls during an active rate limit would just keep re-triggering it
  lastSyncedAt.set(key, Date.now());

  const url = `${config.explorerApiUrl}?module=account&action=tokentx&address=${address}&sort=desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`explorer API request failed: ${res.status}`);

  const body = (await res.json()) as { status: string; result: ExplorerTokenTx[] | string };
  if (!Array.isArray(body.result)) return; // status "0" means no transfers found, not an error

  const knownTokens = new Set([config.usdcAddress.toLowerCase(), config.eurcAddress.toLowerCase()]);

  for (const tx of body.result) {
    if (!knownTokens.has(tx.contractAddress.toLowerCase())) continue;
    if (hasReachTransaction(tx.hash)) continue; // Reach's own transfer, already indexed as a "reach" row

    insertTransaction({
      tx_hash: tx.hash,
      // the explorer doesn't expose a log index for these, and a wallet receiving
      // two different-token transfers in the exact same tx isn't a real scenario
      // here, so one synthetic slot per tx is enough to stay idempotent on re-sync
      log_index: -1,
      block_number: Number(tx.blockNumber),
      sender: tx.from.toLowerCase(),
      receiver: tx.to.toLowerCase(),
      token: tx.contractAddress.toLowerCase(),
      gross_amount: tx.value,
      fee: "0",
      net_amount: tx.value,
      memo: null,
      created_at: Number(tx.timeStamp) * 1000,
      kind: "deposit",
    });
  }
}

export async function startIndexer() {
  await backfill();
  watchLive();
  console.log("indexer caught up, watching for new sends");
}
