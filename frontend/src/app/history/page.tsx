"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useHistory } from "@/lib/hooks";
import type { HistoryEntry } from "@/lib/api";
import { TransactionRow } from "@/components/TransactionRow";
import { TransactionDetailSheet } from "@/components/TransactionDetailSheet";
import { BottomNav } from "@/components/BottomNav";
import { History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function dayLabel(ts: number) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function groupByDay(entries: HistoryEntry[]) {
  const groups = new Map<string, HistoryEntry[]>();
  for (const tx of entries) {
    const label = dayLabel(tx.created_at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(tx);
  }
  return groups;
}

export default function HistoryPage() {
  const { ready, authenticated } = usePrivy();
  const { address } = useAccount();

  if (!ready || !authenticated || !address) return null;

  return <HistoryList address={address} />;
}

function HistoryList({ address }: { address: `0x${string}` }) {
  const { data, isLoading } = useHistory(address);
  const groups = data ? groupByDay(data) : null;
  const [selectedTx, setSelectedTx] = useState<HistoryEntry | null>(null);

  return (
    <>
      <main className="flex-1 max-w-lg mx-auto w-full p-6 pb-28">
        <h1 className="text-lg font-semibold mb-5">History</h1>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && !data?.length && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
              <History className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Transactions you send or receive will show up here.
              </p>
            </div>
          </div>
        )}

        {groups &&
          Array.from(groups.entries()).map(([label, txs]) => (
            <section key={label} className="mb-6">
              <h2 className="text-xs font-medium text-muted-foreground mb-1 px-1">{label}</h2>
              <div className="divide-y divide-border rounded-2xl border border-border bg-card px-4">
                {txs.map((tx) => (
                  <TransactionRow
                    key={`${tx.tx_hash}-${tx.block_number}`}
                    tx={tx}
                    address={address}
                    onClick={() => setSelectedTx(tx)}
                  />
                ))}
              </div>
            </section>
          ))}
      </main>
      <TransactionDetailSheet tx={selectedTx} address={address} onClose={() => setSelectedTx(null)} />
      <BottomNav />
    </>
  );
}
