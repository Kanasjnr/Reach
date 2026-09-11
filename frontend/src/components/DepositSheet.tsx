"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Sheet } from "./Sheet";
import { Copy } from "lucide-react";

export function DepositSheet({
  open,
  onClose,
  address,
}: {
  open: boolean;
  onClose: () => void;
  address: `0x${string}`;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Deposit">
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="p-4 bg-white rounded-2xl border border-border shadow-sm">
          <QRCodeSVG value={address} size={180} fgColor="#18181b" />
        </div>
        <p className="text-xs text-muted-foreground text-center px-4">
          Send USDC or EURC on Arc to this address. Funds from anywhere land here, not just
          through Reach.
        </p>
        <button
          onClick={copy}
          className="flex items-center gap-2 border border-border rounded-full px-4 py-2.5 text-sm font-mono hover:bg-muted transition-colors"
        >
          <Copy className="w-4 h-4" />
          {copied ? "Copied" : `${address.slice(0, 8)}…${address.slice(-6)}`}
        </button>
      </div>
    </Sheet>
  );
}
