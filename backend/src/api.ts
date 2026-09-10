import cors from "cors";
import express from "express";
import { isAddress } from "viem";
import { config } from "./config.js";
import { publicClient, erc20Abi } from "./chain.js";
import { getHistory, getSyncedBlock, savePushSubscription } from "./db.js";
import { resolveReceiverWallet } from "./identity.js";

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

app.get("/history/:address", (req, res) => {
  if (!isAddress(req.params.address)) return res.status(400).json({ error: "invalid address" });
  res.json(getHistory(req.params.address));
});

app.post("/resolve-receiver", async (req, res) => {
  const { email } = req.body;
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "valid email required" });
  }

  try {
    const address = await resolveReceiverWallet(email);
    res.json({ address });
  } catch {
    res.status(502).json({ error: "could not resolve wallet" });
  }
});

app.post("/push-subscribe", (req, res) => {
  const { address, subscription } = req.body;
  if (!isAddress(address)) return res.status(400).json({ error: "invalid address" });
  if (!subscription?.endpoint) return res.status(400).json({ error: "invalid subscription" });

  savePushSubscription(address, subscription);
  res.json({ ok: true });
});
