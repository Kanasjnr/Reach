import Database from "better-sqlite3";

export const db = new Database(process.env.DB_PATH ?? "reach.sqlite");
db.pragma("journal_mode = WAL");

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
    PRIMARY KEY (tx_hash, log_index)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender);
  CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver);

  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_synced_block TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wallets (
    email TEXT PRIMARY KEY,
    address TEXT NOT NULL
  );
`);

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
}

const insertTx = db.prepare(`
  INSERT OR IGNORE INTO transactions
    (tx_hash, log_index, block_number, sender, receiver, token, gross_amount, fee, net_amount, memo, created_at)
  VALUES (@tx_hash, @log_index, @block_number, @sender, @receiver, @token, @gross_amount, @fee, @net_amount, @memo, @created_at)
`);

export function insertTransaction(row: TransactionRow) {
  insertTx.run(row);
}

export function getSyncedBlock(defaultBlock: bigint): bigint {
  const row = db.prepare("SELECT last_synced_block FROM sync_state WHERE id = 1").get() as
    | { last_synced_block: string }
    | undefined;
  return row ? BigInt(row.last_synced_block) : defaultBlock;
}

export function setSyncedBlock(block: bigint) {
  db.prepare(
    "INSERT INTO sync_state (id, last_synced_block) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET last_synced_block = excluded.last_synced_block"
  ).run(block.toString());
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

export function getEmailForWallet(address: string): string | undefined {
  const row = db.prepare("SELECT email FROM wallets WHERE address = ?").get(address.toLowerCase()) as
    | { email: string }
    | undefined;
  return row?.email;
}
