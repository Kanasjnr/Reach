import { createConfig } from "@privy-io/wagmi";
import { http } from "viem";
import { arcTestnet } from "./chain";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  // Arc's testnet RPC occasionally blips under load — a longer timeout and a
  // few retries turns a one-off network hiccup into a slightly slower send
  // instead of a failed one.
  transports: { [arcTestnet.id]: http(undefined, { retryCount: 5, retryDelay: 500, timeout: 15_000 }) },
});
