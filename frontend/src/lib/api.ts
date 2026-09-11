const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4021";

export async function resolveReceiver(email: string): Promise<string> {
  const res = await fetch(`${API_URL}/resolve-receiver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "could not resolve receiver");
  return (await res.json()).address;
}

export interface HistoryEntry {
  tx_hash: string;
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

export async function getHistory(address: string): Promise<HistoryEntry[]> {
  const res = await fetch(`${API_URL}/history/${address}`);
  if (!res.ok) throw new Error(`history fetch failed: ${res.status}`);
  return res.json();
}

export async function getBalance(address: string, token: string): Promise<bigint> {
  const res = await fetch(`${API_URL}/balance/${address}?token=${token}`);
  if (!res.ok) throw new Error(`balance fetch failed: ${res.status}`);
  return BigInt((await res.json()).balance);
}

export async function subscribeToPush(address: string, subscription: PushSubscription) {
  await fetch(`${API_URL}/push-subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, subscription }),
  });
}
