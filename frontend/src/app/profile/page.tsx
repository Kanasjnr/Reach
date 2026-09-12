"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { enablePushNotifications } from "@/lib/push";
import { setDisplayName as saveDisplayName } from "@/lib/api";
import { useDisplayName } from "@/lib/hooks";
import { Copy, Pencil } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ProfilePage() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { address } = useAccount();

  if (!ready || !authenticated || !address) return null;

  const email = user?.email?.address ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <>
      <main className="flex-1 max-w-lg mx-auto w-full p-6 pb-28 space-y-6">
        <div className="flex flex-col items-center gap-3 py-4">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="brand-gradient text-white text-xl font-medium">
              {initial}
            </AvatarFallback>
          </Avatar>
          <p className="text-base text-muted-foreground">{email || "No email linked"}</p>
        </div>

        <Card className="p-0 divide-y divide-border overflow-hidden rounded-2xl">
          <DisplayNameRow address={address} />
          <AddressRow address={address} />
        </Card>

        <Card className="p-0 rounded-2xl">
          <PushToggle address={address} />
        </Card>

        <Button
          onClick={logout}
          variant="destructive"
          className="w-full rounded-full h-11"
        >
          Log out
        </Button>
      </main>
      <BottomNav />
    </>
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
      <span className="text-base text-muted-foreground">Wallet</span>
      <span className="text-base font-mono flex items-center gap-2">
        {copied ? "Copied" : `${address.slice(0, 6)}…${address.slice(-4)}`}
        <Copy className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

function DisplayNameRow({ address }: { address: `0x${string}` }) {
  const { data: savedName } = useDisplayName(address);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  function startEditing() {
    setDraft(savedName ?? "");
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return setError("Name can't be empty");
    setSaving(true);
    setError(null);
    try {
      await saveDisplayName(address, trimmed);
      queryClient.setQueryData(["displayName", address], trimmed);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save name");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-2 px-4 py-3.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={40}
          placeholder="Your name"
          className="flex-1 min-w-0 text-base bg-transparent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm text-muted-foreground"
        >
          Cancel
        </button>
        <Button type="submit" size="sm" disabled={saving} className="rounded-full h-8">
          Save
        </Button>
        {error && <p className="text-sm text-destructive absolute mt-8">{error}</p>}
      </form>
    );
  }

  return (
    <button onClick={startEditing} className="w-full flex items-center justify-between px-4 py-3.5">
      <span className="text-base text-muted-foreground">Name</span>
      <span className="text-base flex items-center gap-2">
        {savedName || "Add a name"}
        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
      </span>
    </button>
  );
}

function PushToggle({ address }: { address: `0x${string}` }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(
      typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        localStorage.getItem(`push-enabled:${address}`) === "1"
    );
  }, [address]);

  async function toggle(checked: boolean) {
    if (!checked) return;
    setLoading(true);
    setError(null);
    try {
      await enablePushNotifications(address);
      localStorage.setItem(`push-enabled:${address}`, "1");
      setEnabled(true);
    } catch (err) {
      setEnabled(false);
      setError(err instanceof Error ? err.message : "Could not enable notifications");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base">Push notifications</div>
          <div className="text-sm text-muted-foreground">Get notified when funds arrive</div>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} disabled={loading} />
      </div>
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  );
}
