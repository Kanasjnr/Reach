"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { TOKENS } from "@/lib/chain";
import { useBalances, useHistory } from "@/lib/hooks";
import { SendIcon, DepositIcon } from "@/components/icons";
import { SendSheet } from "@/components/SendSheet";
import { DepositSheet } from "@/components/DepositSheet";
import { TransactionRow } from "@/components/TransactionRow";
import { BottomNav } from "@/components/BottomNav";

export default function Home() {
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();

  if (!ready) return null;

  if (!authenticated) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground text-2xl font-bold">
          R
        </div>
        <div>
          <h1 className="text-xl font-semibold">Reach</h1>
          <p className="text-sm text-muted mt-1">
            Send USDC or EURC instantly, no matter which chain it&apos;s on.
          </p>
        </div>
        <button onClick={login} className="rounded-full bg-accent text-accent-foreground px-8 py-3 text-sm font-medium">
          Log in
        </button>
      </main>
    );
  }

  return address ? <Dashboard address={address} /> : null;
}

function Dashboard({ address }: { address: `0x${string}` }) {
  const [sendOpen, setSendOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const { data: balances } = useBalances(address);
  const { data: history } = useHistory(address);

  const total = balances?.reduce((sum, b) => sum + b, BigInt(0));

  return (
    <>
      <main className="flex-1 max-w-lg mx-auto w-full p-6 pb-28 space-y-8">
        <header className="flex items-center justify-between">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground text-sm font-bold">
            R
          </div>
        </header>

        <section className="text-center py-4">
          <div className="text-sm text-muted mb-1">Balance</div>
          <div className="text-4xl font-semibold tracking-tight">
            {total !== undefined ? formatUnits(total, 6) : "…"}
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs text-muted">
            {TOKENS.map((t, i) => (
              <span key={t.symbol}>
                {balances ? formatUnits(balances[i], 6) : "…"} {t.symbol}
              </span>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSendOpen(true)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface py-4"
          >
            <SendIcon className="w-5 h-5 text-accent" />
            <span className="text-sm font-medium">Send</span>
          </button>
          <button
            onClick={() => setDepositOpen(true)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface py-4"
          >
            <DepositIcon className="w-5 h-5 text-accent" />
            <span className="text-sm font-medium">Deposit</span>
          </button>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium text-muted">Recent activity</h2>
            {!!history?.length && (
              <Link href="/history" className="text-xs text-accent">
                See all
              </Link>
            )}
          </div>
          {history?.length ? (
            <div className="divide-y divide-border">
              {history.slice(0, 4).map((tx) => (
                <TransactionRow key={`${tx.tx_hash}-${tx.block_number}`} tx={tx} address={address} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted py-6 text-center">No activity yet</p>
          )}
        </section>
      </main>

      <SendSheet open={sendOpen} onClose={() => setSendOpen(false)} address={address} />
      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} address={address} />
      <BottomNav />
    </>
  );
}
