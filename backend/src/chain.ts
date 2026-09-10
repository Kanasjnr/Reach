import { createPublicClient, http, defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? "https://rpc.testnet.arc.io"] } },
});

export const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

export const REACH_ADDRESS = process.env.REACH_ADDRESS as `0x${string}`;
export const REACH_DEPLOY_BLOCK = BigInt(process.env.REACH_DEPLOY_BLOCK ?? "61080712");

export const reachAbi = [
  {
    type: "event",
    name: "RemittanceSent",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "grossAmount", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "netAmount", type: "uint256", indexed: false },
      { name: "memo", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [
      { name: "fee", type: "uint256" },
      { name: "netAmount", type: "uint256" },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
