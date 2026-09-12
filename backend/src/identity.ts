import { PrivyClient } from "@privy-io/node";
import { config } from "./config.js";
import { getWalletForEmail, cacheWalletForEmail, getDisplayName } from "./db.js";

const privy = new PrivyClient({ appId: config.privyAppId, appSecret: config.privyAppSecret });

function extractWalletAddress(linkedAccounts: any[]): string | undefined {
  return linkedAccounts.find((a) => a.type === "wallet" && a.chain_type === "ethereum")?.address;
}

export interface ResolvedReceiver {
  address: string;
  isNew: boolean;
  displayName?: string;
}

export async function resolveReceiverWallet(email: string): Promise<ResolvedReceiver> {
  const cached = getWalletForEmail(email);
  if (cached) return { address: cached, isNew: false, displayName: getDisplayName(cached) };

  const users = privy.users();
  let user;
  try {
    user = await users.getByEmailAddress({ address: email });
  } catch {
    user = null;
  }

  if (!user) {
    user = await users.create({
      linked_accounts: [{ type: "email", address: email }],
      wallets: [{ chain_type: "ethereum" }],
    });
  }

  let address = extractWalletAddress(user.linked_accounts);
  if (!address) {
    // existing user, but from some other flow that never created an ethereum wallet
    user = await users.pregenerateWallets(user.id, { wallets: [{ chain_type: "ethereum" }] });
    address = extractWalletAddress(user.linked_accounts);
  }
  if (!address) throw new Error(`no wallet came back for ${email}`);

  cacheWalletForEmail(email, address);
  // "new" means new to Reach specifically (never resolved before), not whether
  // Privy already had an account for this email from some unrelated app
  return { address, isNew: true, displayName: getDisplayName(address) };
}
