import cors from "cors";
import express from "express";
import { isAddress } from "viem";
import { config } from "./config.js";
import { publicClient, erc20Abi } from "./chain.js";
import { getHistory, getSyncedBlock, savePushSubscription, setDisplayName, getDisplayName } from "./db.js";
import { resolveReceiverWallet } from "./identity.js";
import { syncDeposits } from "./indexer.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, syncedBlock: getSyncedBlock(0n).toString() });
});

// Balance always comes straight from the chain, not the indexer's DB — a wallet's
// balance reflects every transfer it's ever been part of, not just sends through Reach.
app.get("/balance/:address", async (req, res) => {
  const { address } = req.params;
  const { token } = req.query;
  if (!isAddress(address)) return res.status(400).json({ error: "invalid address" });
  if (typeof token !== "string" || !isAddress(token)) {
    return res.status(400).json({ error: "valid token query param required" });
  }

  try {
    const balance = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    res.json({ balance: balance.toString() });
  } catch {
    res.status(502).json({ error: "could not read balance" });
  }
});

app.get("/history/:address", async (req, res) => {
  const { address } = req.params;
  if (!isAddress(address)) return res.status(400).json({ error: "invalid address" });

  try {
    await syncDeposits(address);
  } catch (err) {
    // Deposits are a live on-chain scan on top of the indexed Reach history —
    // if the RPC hiccups, still return what we already have rather than failing
    // the whole request.
    console.error("deposit sync failed", address, err);
  }

  res.json(getHistory(address));
});

app.post("/resolve-receiver", async (req, res) => {
  const { email } = req.body;
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "valid email required" });
  }

  try {
    const resolved = await resolveReceiverWallet(email);
    res.json(resolved);
  } catch {
    res.status(502).json({ error: "could not resolve wallet" });
  }
});

app.get("/profile/:address", (req, res) => {
  const { address } = req.params;
  if (!isAddress(address)) return res.status(400).json({ error: "invalid address" });
  res.json({ displayName: getDisplayName(address) ?? null });
});

app.post("/profile", (req, res) => {
  const { address, displayName } = req.body;
  if (!isAddress(address)) return res.status(400).json({ error: "invalid address" });
  if (typeof displayName !== "string" || !displayName.trim() || displayName.length > 40) {
    return res.status(400).json({ error: "displayName must be 1-40 characters" });
  }

  setDisplayName(address, displayName.trim());
  res.json({ ok: true });
});

app.post("/push-subscribe", (req, res) => {
  const { address, subscription } = req.body;
  if (!isAddress(address)) return res.status(400).json({ error: "invalid address" });
  if (!subscription?.endpoint) return res.status(400).json({ error: "invalid subscription" });

  savePushSubscription(address, subscription);
  res.json({ ok: true });
});
