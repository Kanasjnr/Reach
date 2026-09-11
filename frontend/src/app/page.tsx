"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseUnits, stringToHex, isAddress } from "viem";
import { REACH_ADDRESS, TOKENS } from "@/lib/chain";
import { reachAbi, erc20Abi } from "@/lib/reachAbi";
import { resolveReceiver, getHistory, getBalance } from "@/lib/api";
import { wagmiConfig } from "@/lib/wagmiConfig";

export default function Home() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useAccount();

  if (!ready) return null;

  return (
    <main className="flex-1 max-w-lg mx-auto w-full p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reach</h1>
        {authenticated ? (
          <button onClick={logout} className="text-sm text-gray-500">
            Log out
          </button>
        ) : (
          <button onClick={login} className="rounded bg-black text-white px-4 py-2 text-sm">
            Log in
          </button>
        )}
      </header>

      {authenticated && address && (
        <>
          <Balances address={address} />
          <SendForm address={address} />
          <History address={address} />
        </>
      )}
    </main>
  );
}

function Balances({ address }: { address: `0x${string}` }) {
  const { data } = useQuery({
    queryKey: ["balances", address],
    queryFn: async () =>
      Promise.all(TOKENS.map((t) => getBalance(address, t.address))),
    refetchInterval: 10_000,
  });

  return (
    <section className="grid grid-cols-2 gap-3">
      {TOKENS.map((t, i) => (
        <div key={t.symbol} className="border rounded p-3">
          <div className="text-xs text-gray-500">{t.symbol}</div>
          <div className="text-lg font-medium">
            {data ? formatUnits(data[i], 6) : "…"}
          </div>
        </div>
      ))}
    </section>
  );
}

function SendForm({ address }: { address: `0x${string}` }) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<(typeof TOKENS)[number]>(TOKENS[0]);
  const [status, setStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: feeBps } = useReadContract({
    address: REACH_ADDRESS,
    abi: reachAbi,
    functionName: "feeBps",
  });

  const { writeContractAsync } = useWriteContract();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setStatus("resolving receiver…");
    try {
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
      await waitFor(approveHash);

      setStatus("sending…");
      const sendHash = await writeContractAsync({
        address: REACH_ADDRESS,
        abi: reachAbi,
        functionName: "send",
        args: [receiver, token.address, rawAmount, feeBps ?? 65535, stringToHex("", { size: 32 })],
      });
      await waitFor(sendHash);

      setStatus("sent");
      setEmail("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["balances", address] });
      queryClient.invalidateQueries({ queryKey: ["history", address] });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "send failed");
    }
  }

  return (
    <form onSubmit={handleSend} className="space-y-3 border rounded p-4">
      <input
        type="email"
        required
        placeholder="receiver@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          type="number"
          required
          min="0"
          step="0.000001"
          placeholder="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <select
          value={token.symbol}
          onChange={(e) => setToken(TOKENS.find((t) => t.symbol === e.target.value)!)}
          className="border rounded px-3 py-2 text-sm"
        >
          {TOKENS.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="w-full rounded bg-black text-white px-4 py-2 text-sm">
        Send
      </button>
      {status && <p className="text-xs text-gray-500">{status}</p>}
    </form>
  );
}

function History({ address }: { address: `0x${string}` }) {
  const { data } = useQuery({
    queryKey: ["history", address],
    queryFn: () => getHistory(address),
    refetchInterval: 10_000,
  });

  if (!data?.length) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-500">History</h2>
      {data.map((tx) => {
        const outgoing = tx.sender === address.toLowerCase();
        return (
          <div key={`${tx.tx_hash}-${tx.block_number}`} className="border rounded p-3 text-sm flex justify-between">
            <span>{outgoing ? "Sent" : "Received"}</span>
            <span>{formatUnits(BigInt(tx.net_amount), 6)}</span>
          </div>
        );
      })}
    </section>
  );
}

// useWaitForTransactionReceipt is the idiomatic wagmi hook for this, but this runs
// inside an event handler, not render, so it needs the imperative client directly
async function waitFor(hash: `0x${string}`) {
  await getPublicClient(wagmiConfig)?.waitForTransactionReceipt({ hash });
}
