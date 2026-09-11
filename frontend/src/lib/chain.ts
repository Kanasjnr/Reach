import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
});

export const REACH_ADDRESS = process.env.NEXT_PUBLIC_REACH_ADDRESS as `0x${string}`;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
export const EURC_ADDRESS = process.env.NEXT_PUBLIC_EURC_ADDRESS as `0x${string}`;

export const TOKENS = [
  { symbol: "USDC", address: USDC_ADDRESS },
  { symbol: "EURC", address: EURC_ADDRESS },
] as const;
