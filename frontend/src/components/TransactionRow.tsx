import { formatUnits } from "viem";
import type { HistoryEntry } from "@/lib/api";
import { TOKENS } from "@/lib/chain";
import { SendIcon, DepositIcon } from "./icons";

function symbolFor(token: string) {
  return TOKENS.find((t) => t.address.toLowerCase() === token.toLowerCase())?.symbol ?? "?";
}

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function TransactionRow({ tx, address }: { tx: HistoryEntry; address: `0x${string}` }) {
  const outgoing = tx.sender === address.toLowerCase();
  const counterparty = outgoing ? tx.receiver : tx.sender;

  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          outgoing ? "bg-border text-foreground" : "bg-accent/10 text-accent"
        }`}
      >
        {outgoing ? <SendIcon className="w-4 h-4" /> : <DepositIcon className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{outgoing ? "Sent" : "Received"}</div>
        <div className="text-xs text-muted truncate">{short(counterparty)}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">
          {outgoing ? "-" : "+"}
          {formatUnits(BigInt(tx.net_amount), 6)}
        </div>
        <div className="text-xs text-muted">{symbolFor(tx.token)}</div>
      </div>
    </div>
  );
}
