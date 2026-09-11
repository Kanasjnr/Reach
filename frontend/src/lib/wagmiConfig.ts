import { createConfig } from "@privy-io/wagmi";
import { http } from "viem";
import { arcTestnet } from "./chain";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: { [arcTestnet.id]: http() },
});
