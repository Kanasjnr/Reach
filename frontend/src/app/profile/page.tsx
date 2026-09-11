"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { enablePushNotifications } from "@/lib/push";
import { CopyIcon } from "@/components/icons";
import { BottomNav } from "@/components/BottomNav";

export default function ProfilePage() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { address } = useAccount();

  if (!ready || !authenticated || !address) return null;

  return (
    <>
      <main className="flex-1 max-w-lg mx-auto w-full p-6 pb-28 space-y-6">
        <h1 className="text-lg font-semibold">Profile</h1>

        <section className="border border-border rounded-2xl divide-y divide-border">
          <Row label="Email" value={user?.email?.address ?? "—"} />
          <AddressRow address={address} />
        </section>

        <PushToggle address={address} />

        <button
          onClick={logout}
          className="w-full rounded-full border border-border px-4 py-3 text-sm font-medium text-danger"
        >
          Log out
        </button>
      </main>
      <BottomNav />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function AddressRow({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="w-full flex items-center justify-between px-4 py-3.5"
    >
      <span className="text-sm text-muted">Wallet</span>
      <span className="text-sm font-mono flex items-center gap-2">
        {copied ? "Copied" : `${address.slice(0, 6)}…${address.slice(-4)}`}
        <CopyIcon className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

function PushToggle({ address }: { address: `0x${string}` }) {
  const [status, setStatus] = useState<"idle" | "loading" | "on" | "error">("idle");

  async function enable() {
    setStatus("loading");
    try {
      await enablePushNotifications(address);
      setStatus("on");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="border border-border rounded-2xl px-4 py-3.5 flex items-center justify-between">
      <div>
        <div className="text-sm">Push notifications</div>
        <div className="text-xs text-muted">Get notified when funds arrive</div>
      </div>
      <button
        onClick={enable}
        disabled={status === "loading" || status === "on"}
        className="text-xs font-medium text-accent disabled:text-muted"
      >
        {status === "on" ? "Enabled" : status === "loading" ? "Enabling…" : status === "error" ? "Retry" : "Enable"}
      </button>
    </section>
  );
}
