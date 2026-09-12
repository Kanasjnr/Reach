"use client";

import { useState } from "react";
import { useWriteContract, useReadContract } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits, formatUnits, stringToHex, isAddress, BaseError, ContractFunctionRevertedError } from "viem";
import { Check, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { REACH_ADDRESS, TOKENS } from "@/lib/chain";
import { reachAbi, erc20Abi } from "@/lib/reachAbi";
import { resolveReceiver, type ResolvedReceiver } from "@/lib/api";
import { wagmiConfig } from "@/lib/wagmiConfig";
import { Sheet } from "./Sheet";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Step = "form" | "confirm" | "processing" | "success";

function describeSendError(err: unknown, symbol: string): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const errorName = revert.data?.errorName;
      const args = revert.data?.args as readonly unknown[] | undefined;
      switch (errorName) {
        case "AmountTooSmall":
          return `Minimum send is ${formatUnits(args?.[1] as bigint, 6)} ${symbol}`;
        case "TokenNotAllowed":
          return `${symbol} isn't supported for sending right now`;
        case "InvalidReceiver":
          return "That recipient address isn't valid";
        case "FeeTooHigh":
        case "FeeExceedsCallerMax":
          return "Network fee changed, please try again";
        default:
          return errorName ? `Send failed: ${errorName}` : "Send failed";
      }
    }
    return err.shortMessage || "Send failed";
  }
  return err instanceof Error ? err.message : "Send failed";
}

export function SendSheet({
  open,
  onClose,
  address,
}: {
  open: boolean;
  onClose: () => void;
  address: `0x${string}`;
}) {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<(typeof TOKENS)[number]>(TOKENS[0]);
  const [receiver, setReceiver] = useState<ResolvedReceiver | null>(null);
  const [resolving, setResolving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const rawAmount = (() => {
    try {
      return amount ? parseUnits(amount, 6) : BigInt(0);
    } catch {
      return BigInt(0);
    }
  })();

  const { data: feeBps } = useReadContract({
    address: REACH_ADDRESS,
    abi: reachAbi,
    functionName: "feeBps",
  });

  const { data: minAmount } = useReadContract({
    address: REACH_ADDRESS,
    abi: reachAbi,
    functionName: "minAmount",
  });

  const { data: quoteData } = useReadContract({
    address: REACH_ADDRESS,
    abi: reachAbi,
    functionName: "quote",
    args: [rawAmount],
    query: { enabled: rawAmount > BigInt(0) },
  });
  const fee = quoteData?.[0] ?? BigInt(0);
  const netAmount = quoteData?.[1] ?? rawAmount;

  const { writeContractAsync } = useWriteContract();

  function reset() {
    setStep("form");
    setEmail("");
    setAmount("");
    setToken(TOKENS[0]);
    setReceiver(null);
    setErrorMsg(null);
  }

  function handleClose() {
    if (step === "processing") return; // don't let a tx in flight get abandoned mid-air
    reset();
    onClose();
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!EMAIL_RE.test(email)) return setErrorMsg("Enter a valid email address");
    if (!(Number(amount) > 0)) return setErrorMsg("Enter an amount greater than 0");
    if (minAmount !== undefined && rawAmount < minAmount) {
      return setErrorMsg(`Minimum send is ${formatUnits(minAmount, 6)} ${token.symbol}`);
    }

    setResolving(true);
    try {
      const resolved = await resolveReceiver(email);
      if (!isAddress(resolved.address)) throw new Error("Resolver returned an invalid address");
      setReceiver(resolved);
      setStep("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not find that recipient");
    } finally {
      setResolving(false);
    }
  }

  async function handleSend() {
    if (!receiver) return;
    setStep("processing");
    setErrorMsg(null);

    try {
      const approveHash = await writeContractAsync({
        address: token.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [REACH_ADDRESS, rawAmount],
      });
      await getPublicClient(wagmiConfig)?.waitForTransactionReceipt({ hash: approveHash });

      const sendHash = await writeContractAsync({
        address: REACH_ADDRESS,
        abi: reachAbi,
        functionName: "send",
        args: [
          receiver.address as `0x${string}`,
          token.address,
          rawAmount,
          feeBps ?? 65535,
          stringToHex("", { size: 32 }),
        ],
      });
      await getPublicClient(wagmiConfig)?.waitForTransactionReceipt({ hash: sendHash });

      queryClient.invalidateQueries({ queryKey: ["balances", address] });
      queryClient.invalidateQueries({ queryKey: ["history", address] });
      setStep("success");
    } catch (err) {
      setErrorMsg(describeSendError(err, token.symbol));
      setStep("confirm");
    }
  }

  return (
    <>
      <Sheet open={open && (step === "form" || step === "confirm")} onClose={handleClose} title={step === "confirm" ? "Confirm" : "Send"}>
        {step === "form" && (
          <form onSubmit={handleContinue} className="space-y-4 pt-1">
            <div className="flex gap-2">
              {TOKENS.map((t) => (
                <button
                  key={t.symbol}
                  type="button"
                  onClick={() => setToken(t)}
                  className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl border text-base font-medium transition-colors ${
                    token.symbol === t.symbol
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <img src={t.icon} alt="" className="w-5 h-5 rounded-full" />
                  {t.symbol}
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block px-1">
                Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  step="0.000001"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-16 rounded-2xl border border-input bg-background px-4 text-3xl font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
                  {token.symbol}
                </span>
              </div>
              {minAmount !== undefined && (
                <p className="text-sm text-muted-foreground mt-1.5 px-1">
                  Minimum {formatUnits(minAmount, 6)} {token.symbol}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block px-1">
                To
              </label>
              <input
                type="email"
                required
                placeholder="receiver@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 rounded-2xl border border-input bg-background px-4 text-base focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-destructive text-sm px-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              disabled={resolving}
              size="lg"
              className="w-full rounded-full h-12 text-base brand-gradient border-0"
            >
              {resolving ? "Finding recipient…" : "Continue"}
            </Button>
          </form>
        )}

        {step === "confirm" && receiver && (
          <div className="space-y-6 pt-1">
            <div className="flex flex-col items-center gap-2 py-2">
              <img src={token.icon} alt="" className="w-10 h-10 rounded-full" />
              <p className="text-3xl font-semibold tabular-nums">
                {amount} <span className="text-xl text-muted-foreground">{token.symbol}</span>
              </p>
            </div>

            {receiver.isNew && (
              <div className="flex items-center gap-2 text-sm text-primary bg-accent rounded-xl px-3 py-2.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                New to Reach? Funds will be waiting when they sign up
              </div>
            )}

            <div className="rounded-2xl border border-border divide-y divide-border">
              <DetailRow label="To" value={receiver.displayName ? `${receiver.displayName} (${email})` : email} />
              <DetailRow label="Network" value="Arc Testnet" />
              <DetailRow label="Fee" value={`${formatUnits(fee, 6)} ${token.symbol}`} />
              <DetailRow
                label="Recipient gets"
                value={`${formatUnits(netAmount, 6)} ${token.symbol}`}
                emphasize
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-destructive text-sm px-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="space-y-2.5">
              <Button
                onClick={handleSend}
                size="lg"
                className="w-full rounded-full h-12 text-base brand-gradient border-0"
              >
                Send
              </Button>
              <Button
                onClick={() => setStep("form")}
                variant="outline"
                size="lg"
                className="w-full rounded-full h-12 text-base"
              >
                Edit details
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {step === "processing" && (
        <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-base font-medium text-muted-foreground">Sending…</p>
        </div>
      )}

      {step === "success" && (
        <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-positive/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-positive" strokeWidth={3} />
          </div>
          <div className="space-y-1.5 max-w-xs">
            <p className="text-lg font-semibold">Sent</p>
            <p className="text-base text-muted-foreground">
              {amount} {token.symbol} is on its way to {email}
            </p>
          </div>
          <Button
            onClick={handleClose}
            size="lg"
            className="w-full max-w-xs rounded-full h-12 text-base brand-gradient border-0"
          >
            Done
          </Button>
        </div>
      )}
    </>
  );
}

function DetailRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-base text-muted-foreground">{label}</span>
      <span className={`text-base ${emphasize ? "font-semibold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
