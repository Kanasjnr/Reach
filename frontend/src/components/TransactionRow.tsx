import { formatUnits } from "viem";
import type { HistoryEntry } from "@/lib/api";
import { TOKENS } from "@/lib/chain";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

function symbolFor(token: string) {
  return TOKENS.find((t) => t.address.toLowerCase() === token.toLowerCase())?.symbol ?? "?";
}

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function TransactionRow({
  tx,
  address,
  onClick,
}: {
  tx: HistoryEntry;
  address: `0x${string}`;
  onClick?: () => void;
}) {
  const outgoing = tx.sender === address.toLowerCase();
  const counterparty = outgoing ? tx.receiver : tx.sender;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 text-left active:opacity-70 transition-opacity"
    >
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
          outgoing ? "bg-secondary text-secondary-foreground" : "bg-positive/10 text-positive"
        )}
      >
        {outgoing ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-medium">{outgoing ? "Sent" : "Received"}</div>
        <div className="text-sm text-muted-foreground truncate">{short(counterparty)}</div>
      </div>
      <div className="text-right">
        <div className={cn("text-base font-medium tabular-nums", !outgoing && "text-positive")}>
          {outgoing ? "-" : "+"}
          {formatUnits(BigInt(tx.net_amount), 6)}
        </div>
        <div className="text-sm text-muted-foreground">{symbolFor(tx.token)}</div>
      </div>
    </button>
  );
}
