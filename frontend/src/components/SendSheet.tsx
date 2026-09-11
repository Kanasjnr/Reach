"use client";

import { useState } from "react";
import { useWriteContract, useReadContract } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits, stringToHex, isAddress } from "viem";
import { REACH_ADDRESS, TOKENS } from "@/lib/chain";
import { reachAbi, erc20Abi } from "@/lib/reachAbi";
import { resolveReceiver } from "@/lib/api";
import { wagmiConfig } from "@/lib/wagmiConfig";
import { Sheet } from "./Sheet";

export function SendSheet({
  open,
  onClose,
  address,
}: {
  open: boolean;
  onClose: () => void;
  address: `0x${string}`;
}) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<(typeof TOKENS)[number]>(TOKENS[0]);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  const { data: feeBps } = useReadContract({
    address: REACH_ADDRESS,
    abi: reachAbi,
    functionName: "feeBps",
  });

  const { writeContractAsync } = useWriteContract();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      setStatus("resolving receiver…");
      const receiver = await resolveReceiver(email);
      if (!isAddress(receiver)) throw new Error("resolver returned an invalid address");

      const rawAmount = parseUnits(amount, 6);

      setStatus("approving…");
      const approveHash = await writeContractAsync({
        address: token.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [REACH_ADDRESS, rawAmount],
      });
      await getPublicClient(wagmiConfig)?.waitForTransactionReceipt({ hash: approveHash });

      setStatus("sending…");
      const sendHash = await writeContractAsync({
        address: REACH_ADDRESS,
        abi: reachAbi,
        functionName: "send",
        args: [receiver, token.address, rawAmount, feeBps ?? 65535, stringToHex("", { size: 32 })],
      });
      await getPublicClient(wagmiConfig)?.waitForTransactionReceipt({ hash: sendHash });

      setStatus(null);
      setEmail("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["balances", address] });
      queryClient.invalidateQueries({ queryKey: ["history", address] });
      onClose();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Send">
      <form onSubmit={handleSend} className="space-y-3">
        <input
          type="email"
          required
          placeholder="receiver@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background"
        />
        <div className="flex gap-2">
          <input
            type="number"
            required
            min="0"
            step="0.000001"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 border border-border rounded-xl px-4 py-3 text-sm bg-background"
          />
          <select
            value={token.symbol}
            onChange={(e) => setToken(TOKENS.find((t) => t.symbol === e.target.value)!)}
            className="border border-border rounded-xl px-3 py-3 text-sm bg-background"
          >
            {TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-full bg-accent text-accent-foreground px-4 py-3.5 text-sm font-medium disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
        {status && <p className="text-xs text-muted text-center">{status}</p>}
      </form>
    </Sheet>
  );
}
