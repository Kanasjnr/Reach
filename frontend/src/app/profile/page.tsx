"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { enablePushNotifications } from "@/lib/push";
import { Copy } from "lucide-react";
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
          <p className="text-sm text-muted-foreground">{email || "No email linked"}</p>
        </div>

        <Card className="p-0 divide-y divide-border overflow-hidden rounded-2xl">
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
      <span className="text-sm text-muted-foreground">Wallet</span>
      <span className="text-sm font-mono flex items-center gap-2">
        {copied ? "Copied" : `${address.slice(0, 6)}…${address.slice(-4)}`}
        <Copy className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

function PushToggle({ address }: { address: `0x${string}` }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggle(checked: boolean) {
    if (!checked) return;
    setLoading(true);
    try {
      await enablePushNotifications(address);
      setEnabled(true);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div>
        <div className="text-sm">Push notifications</div>
        <div className="text-xs text-muted-foreground">Get notified when funds arrive</div>
      </div>
      <Switch checked={enabled} onCheckedChange={toggle} disabled={loading} />
    </div>
  );
}
