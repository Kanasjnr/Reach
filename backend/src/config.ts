import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var: ${name}`);
  return value;
}

export const config = {
  rpcUrl: process.env.RPC_URL ?? "https://rpc.testnet.arc.io",
  reachAddress: required("REACH_ADDRESS") as `0x${string}`,
  reachDeployBlock: BigInt(process.env.REACH_DEPLOY_BLOCK ?? "0"),
  usdcAddress: required("USDC_ADDRESS") as `0x${string}`,
  eurcAddress: required("EURC_ADDRESS") as `0x${string}`,
  explorerApiUrl: process.env.EXPLORER_API_URL ?? "https://testnet.arcscan.app/api",

  privyAppId: required("PRIVY_APP_ID"),
  privyAppSecret: required("PRIVY_APP_SECRET"),

  vapidPublicKey: required("VAPID_PUBLIC_KEY"),
  vapidPrivateKey: required("VAPID_PRIVATE_KEY"),
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",

  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  port: Number(process.env.PORT ?? 4021),
  dbPath: process.env.DB_PATH ?? "reach.sqlite",
};
