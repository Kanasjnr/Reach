"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { enablePushNotifications } from "@/lib/push";

export function NotificationBell({ address }: { address: `0x${string}` }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(
      typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        localStorage.getItem(`push-enabled:${address}`) === "1"
    );
  }, [address]);

  async function handleClick() {
    if (enabled || loading) return;
    setLoading(true);
    try {
      await enablePushNotifications(address);
      localStorage.setItem(`push-enabled:${address}`, "1");
      setEnabled(true);
    } catch {
      // permission denied or unsupported — bell stays off, user can tap again
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label={enabled ? "Notifications on" : "Enable notifications"}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
        enabled ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
      }`}
    >
      {enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
    </button>
  );
}
