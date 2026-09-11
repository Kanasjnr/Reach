"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useBalances, useHistory } from "@/lib/hooks";
import { useCountUp } from "@/lib/useCountUp";
import type { HistoryEntry } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowUpRight, ArrowDownLeft, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { SendSheet } from "@/components/SendSheet";
import { DepositSheet } from "@/components/DepositSheet";
import { TransactionRow } from "@/components/TransactionRow";
import { TransactionDetailSheet } from "@/components/TransactionDetailSheet";
import { BottomNav } from "@/components/BottomNav";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const { address } = useAccount();

  if (!ready) return null;
  if (!authenticated) return <LandingScreen />;
  return address ? <Dashboard address={address} /> : null;
}

function LandingScreen() {
  const { login } = usePrivy();

  return (
    <main className="flex-1 relative flex flex-col items-center justify-center gap-8 p-6 text-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(600px circle at 20% 15%, color-mix(in oklab, var(--gradient-from) 22%, transparent), transparent 60%), radial-gradient(600px circle at 85% 80%, color-mix(in oklab, var(--gradient-to) 20%, transparent), transparent 60%)",
        }}
      />

      <Logo size={72} className="drop-shadow-lg" />

      <div className="space-y-3 max-w-xs">
        <h1 className="text-3xl font-semibold tracking-tight">
          Send money <span className="brand-gradient-text">anywhere</span>, instantly
        </h1>
        <p className="text-sm text-muted-foreground">
          USDC or EURC, any email, no seed phrase, no waiting.
        </p>
      </div>

      <Button
        size="lg"
        onClick={login}
        className="rounded-full px-10 h-12 text-base brand-gradient border-0 shadow-lg shadow-primary/25"
      >
        Log in
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Self-custodial</span>
        <span className="w-1 h-1 rounded-full bg-border" />
        <span>USDC & EURC</span>
        <span className="w-1 h-1 rounded-full bg-border" />
        <span>Secured on Arc</span>
      </div>
    </main>
  );
}

function Dashboard({ address }: { address: `0x${string}` }) {
  const { user } = usePrivy();
  const [sendOpen, setSendOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<HistoryEntry | null>(null);
  const [hidden, setHidden] = useState(false);
  const { data: balances, isError: balancesErrored, refetch: refetchBalances } = useBalances(address);
  const { data: history } = useHistory(address);

  const totalRaw = balances?.reduce((sum, b) => sum + b, BigInt(0));
  const totalNumber = totalRaw !== undefined ? Number(formatUnits(totalRaw, 6)) : undefined;
  const animated = useCountUp(totalNumber);
  const email = user?.email?.address ?? "";

  return (
    <>
      <main className="flex-1 max-w-lg mx-auto w-full p-6 pb-28 space-y-6">
        <header className="flex items-center justify-between">
          <Link href="/profile" className="flex items-center gap-3">
            <Avatar className="w-11 h-11">
              <AvatarFallback className="brand-gradient text-white font-medium">
                {email.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold leading-tight">{email || "Welcome"}</p>
              <p className="text-xs text-muted-foreground">Welcome back</p>
            </div>
          </Link>
          <Logo size={28} />
        </header>

        <section
          className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg shadow-primary/20"
          style={{ background: "linear-gradient(160deg, var(--gradient-from), var(--gradient-to))" }}
        >
          <div
            aria-hidden
            className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-white/10"
          />

          <div className="relative">
            <p className="text-sm text-white/70 mb-1">Current balance</p>
            <div className="flex items-center gap-2.5">
              {balancesErrored ? (
                <button onClick={() => refetchBalances()} className="text-sm underline text-white/90">
                  Couldn&apos;t load balance — tap to retry
                </button>
              ) : totalNumber === undefined ? (
                <Skeleton className="h-10 w-32 bg-white/20" />
              ) : (
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {hidden
                    ? "••••••"
                    : animated.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                </span>
              )}
              <button
                onClick={() => setHidden((h) => !h)}
                className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0"
                aria-label={hidden ? "Show balance" : "Hide balance"}
              >
                {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </section>

        <section className="flex gap-3">
          <ActionButton icon={ArrowUpRight} label="Send" onClick={() => setSendOpen(true)} />
          <ActionButton icon={ArrowDownLeft} label="Deposit" onClick={() => setDepositOpen(true)} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium text-muted-foreground">Recent activity</h2>
            {!!history?.length && (
              <Link href="/history" className="text-xs text-primary font-medium">
                See all
              </Link>
            )}
          </div>
          {history?.length ? (
            <div className="divide-y divide-border">
              {history.slice(0, 4).map((tx) => (
                <TransactionRow
                  key={`${tx.tx_hash}-${tx.block_number}`}
                  tx={tx}
                  address={address}
                  onClick={() => setSelectedTx(tx)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No activity yet</p>
          )}
        </section>
      </main>

      <SendSheet open={sendOpen} onClose={() => setSendOpen(false)} address={address} />
      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} address={address} />
      <TransactionDetailSheet tx={selectedTx} address={address} onClose={() => setSelectedTx(null)} />
      <BottomNav />
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 h-[52px] rounded-2xl bg-accent flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
    >
      <Icon className="w-4.5 h-4.5 text-accent-foreground" />
      <span className="text-sm font-semibold text-accent-foreground">{label}</span>
    </button>
  );
}
