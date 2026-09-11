import Database from "better-sqlite3";
import type { PushSubscription } from "web-push";
import { config } from "./config.js";

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

// sync_state used to be a single-row cursor (id=1) for the Reach indexer only.
// Now that deposits (plain ERC20 transfers) are indexed from separate sources,
// each source needs its own cursor — migrate the old shape away if we find it.
const syncStateCols = db.prepare("PRAGMA table_info(sync_state)").all() as { name: string }[];
if (syncStateCols.length && !syncStateCols.some((c) => c.name === "key")) {
  db.exec("DROP TABLE sync_state");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    block_number INTEGER NOT NULL,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    token TEXT NOT NULL,
    gross_amount TEXT NOT NULL,
    fee TEXT NOT NULL,
    net_amount TEXT NOT NULL,
    memo TEXT,
    created_at INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'reach',
    PRIMARY KEY (tx_hash, log_index)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender);
  CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver);

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    last_synced_block TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wallets (
    email TEXT PRIMARY KEY,
    address TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    address TEXT PRIMARY KEY,
    subscription TEXT NOT NULL
  );
`);

const txCols = db.prepare("PRAGMA table_info(transactions)").all() as { name: string }[];
if (!txCols.some((c) => c.name === "kind")) {
  db.exec("ALTER TABLE transactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'reach'");
}

export interface TransactionRow {
  tx_hash: string;
  log_index: number;
  block_number: number;
  sender: string;
  receiver: string;
  token: string;
  gross_amount: string;
  fee: string;
  net_amount: string;
  memo: string | null;
  created_at: number;
  kind: "reach" | "deposit";
}

const insertTx = db.prepare(`
  INSERT OR IGNORE INTO transactions
    (tx_hash, log_index, block_number, sender, receiver, token, gross_amount, fee, net_amount, memo, created_at, kind)
  VALUES (@tx_hash, @log_index, @block_number, @sender, @receiver, @token, @gross_amount, @fee, @net_amount, @memo, @created_at, @kind)
`);

export function insertTransaction(row: TransactionRow) {
  insertTx.run(row);
}

export function getSyncedBlock(defaultBlock: bigint, key = "reach"): bigint {
  const row = db.prepare("SELECT last_synced_block FROM sync_state WHERE key = ?").get(key) as
    | { last_synced_block: string }
    | undefined;
  return row ? BigInt(row.last_synced_block) : defaultBlock;
}

export function setSyncedBlock(block: bigint, key = "reach") {
  db.prepare(
    "INSERT INTO sync_state (key, last_synced_block) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET last_synced_block = excluded.last_synced_block"
  ).run(key, block.toString());
}

export function hasReachTransaction(txHash: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM transactions WHERE tx_hash = ? AND kind = 'reach' LIMIT 1")
    .get(txHash);
}

export function getHistory(address: string, limit = 50): TransactionRow[] {
  return db
    .prepare(
      `SELECT * FROM transactions WHERE sender = ? OR receiver = ? ORDER BY block_number DESC LIMIT ?`
    )
    .all(address.toLowerCase(), address.toLowerCase(), limit) as TransactionRow[];
}

export function getWalletForEmail(email: string): string | undefined {
  const row = db.prepare("SELECT address FROM wallets WHERE email = ?").get(email) as
    | { address: string }
    | undefined;
  return row?.address;
}

export function cacheWalletForEmail(email: string, address: string) {
  db.prepare("INSERT OR REPLACE INTO wallets (email, address) VALUES (?, ?)").run(
    email,
    address.toLowerCase()
  );
}

export function savePushSubscription(address: string, subscription: unknown) {
  db.prepare("INSERT OR REPLACE INTO push_subscriptions (address, subscription) VALUES (?, ?)").run(
    address.toLowerCase(),
    JSON.stringify(subscription)
  );
}

export function getPushSubscription(address: string): PushSubscription | undefined {
  const row = db
    .prepare("SELECT subscription FROM push_subscriptions WHERE address = ?")
    .get(address.toLowerCase()) as { subscription: string } | undefined;
  return row ? JSON.parse(row.subscription) : undefined;
}
