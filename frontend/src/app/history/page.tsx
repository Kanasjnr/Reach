"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useHistory } from "@/lib/hooks";
import { TransactionRow } from "@/components/TransactionRow";
import { BottomNav } from "@/components/BottomNav";

export default function HistoryPage() {
  const { ready, authenticated } = usePrivy();
  const { address } = useAccount();

  if (!ready || !authenticated || !address) return null;

  return <HistoryList address={address} />;
}

function HistoryList({ address }: { address: `0x${string}` }) {
  const { data, isLoading } = useHistory(address);

  return (
    <>
      <main className="flex-1 max-w-lg mx-auto w-full p-6 pb-28">
        <h1 className="text-lg font-semibold mb-4">History</h1>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && !data?.length && <p className="text-sm text-muted py-6 text-center">No activity yet</p>}
        {!!data?.length && (
          <div className="divide-y divide-border">
            {data.map((tx) => (
              <TransactionRow key={`${tx.tx_hash}-${tx.block_number}`} tx={tx} address={address} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
