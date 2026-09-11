"use client";

import { formatUnits } from "viem";
import { ExternalLink, Copy, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { HistoryEntry } from "@/lib/api";
import { TOKENS, arcTestnet } from "@/lib/chain";
import { Sheet } from "./Sheet";

function symbolFor(token: string) {
  return TOKENS.find((t) => t.address.toLowerCase() === token.toLowerCase())?.symbol ?? "?";
}

export function TransactionDetailSheet({
  tx,
  address,
  onClose,
}: {
  tx: HistoryEntry | null;
  address: `0x${string}`;
  onClose: () => void;
}) {
  const outgoing = tx?.sender === address.toLowerCase();
  const counterparty = tx ? (outgoing ? tx.receiver : tx.sender) : "";
  const explorerUrl = tx ? `${arcTestnet.blockExplorers.default.url}/tx/${tx.tx_hash}` : "";

  return (
    <Sheet open={!!tx} onClose={onClose} title="Transaction">
      {tx && (
        <div className="space-y-6 pb-2">
          <div className="flex flex-col items-center gap-3 py-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                outgoing ? "bg-secondary text-secondary-foreground" : "bg-positive/10 text-positive"
              }`}
            >
              {outgoing ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold tabular-nums">
                {outgoing ? "-" : "+"}
                {formatUnits(BigInt(tx.net_amount), 6)} {symbolFor(tx.token)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{outgoing ? "Sent" : "Received"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border divide-y divide-border">
            <DetailRow label={outgoing ? "To" : "From"} value={short(counterparty)} />
            <DetailRow label="Network" value="Arc Testnet" />
            <DetailRow
              label="Date"
              value={new Date(tx.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            />
            <DetailRow
              label="Transaction"
              value={short(tx.tx_hash)}
              onCopy={() => navigator.clipboard.writeText(tx.tx_hash)}
            />
          </div>

          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center gap-2 text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            View on Arcscan
          </a>
        </div>
      )}
    </Sheet>
  );
}

function short(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function DetailRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono flex items-center gap-2">
        {value}
        {onCopy && (
          <button onClick={onCopy} className="text-primary">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}
