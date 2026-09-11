"use client";

import { useEffect } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { arcTestnet } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmiConfig";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  }, []);

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // "all-users", not "users-without-wallets" — the whole point of Reach is
        // no external wallet needed. If a user's Privy account already has some
        // other wallet linked (e.g. MetaMask from an unrelated prior connection),
        // "users-without-wallets" would skip creating our embedded wallet and let
        // that external one win instead, which defeats the actual product.
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
        loginMethods: ["email", "sms"],
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
