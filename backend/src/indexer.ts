import { publicClient, reachAbi } from "./chain.js";
import { config } from "./config.js";
import { getSyncedBlock, setSyncedBlock, insertTransaction, type TransactionRow } from "./db.js";
import { notifyReceiver } from "./notifier.js";

// Arc produces blocks fast, so a deploy from a few hours ago can already be hundreds
// of thousands of blocks back — bigger chunks means fewer requests, which is what
// actually matters against a requests-per-second limit (a smaller range just means
// more requests hitting the same limit sooner).
const CHUNK_SIZE = 20_000n;
const PACE_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toRow(log: any): TransactionRow {
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
  };
}

async function handleLogs(logs: any[]) {
  for (const log of logs) {
    const row = toRow(log);
    insertTransaction(row);
    notifyReceiver(row.receiver, row.net_amount, row.token).catch((err) =>
      console.error("notify failed", row.tx_hash, err)
    );
  }
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

export async function startIndexer() {
  await backfill();
  watchLive();
  console.log("indexer caught up, watching for new sends");
}
