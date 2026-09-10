import express from "express";
import { publicClient, erc20Abi } from "./chain.js";
import { getHistory } from "./db.js";
import { resolveReceiverWallet } from "./identity.js";

export const app = express();
app.use(express.json());

// Balance always comes straight from the chain, not the indexer's DB 
// a wallet's balance reflects every transfer it's ever been part of, not just sends through Reach.
app.get("/balance/:address", async (req, res) => {
  const { address } = req.params;
  const { token } = req.query;
  if (typeof token !== "string") return res.status(400).json({ error: "token query param required" });

  try {
    const balance = await publicClient.readContract({
      address: token as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    res.json({ balance: balance.toString() });
  } catch {
    res.status(502).json({ error: "could not read balance" });
  }
});

app.get("/history/:address", (req, res) => {
  res.json(getHistory(req.params.address));
});

app.post("/resolve-receiver", async (req, res) => {
  const { email } = req.body;
  if (typeof email !== "string") return res.status(400).json({ error: "email required" });

  try {
    const address = await resolveReceiverWallet(email);
    res.json({ address });
  } catch (err) {
    res.status(502).json({ error: "could not resolve wallet" });
  }
});
