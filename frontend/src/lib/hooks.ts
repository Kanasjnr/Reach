import { useQuery } from "@tanstack/react-query";
import { TOKENS } from "./chain";
import { getBalance, getHistory, getDisplayName } from "./api";

export function useBalances(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["balances", address],
    queryFn: async () => Promise.all(TOKENS.map((t) => getBalance(address!, t.address))),
    enabled: !!address,
    refetchInterval: 10_000,
  });
}

export function useHistory(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["history", address],
    queryFn: () => getHistory(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });
}

export function useDisplayName(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["displayName", address],
    queryFn: () => getDisplayName(address!),
    enabled: !!address,
  });
}
