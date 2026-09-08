# Reach

Send USDC or EURC instantly, no matter which chain it's actually sitting on. Built on Arc, with Privy for wallet onboarding and Circle's Gateway/Unified Balance Kit for chain-agnostic sending.

## What's here

- **`contracts/`** — `Reach.sol`, the atomic push-payment router. Pulls the sender's chosen token (USDC or EURC, admin-managed allowlist) in one transaction and forwards net-of-fee to the receiver — no escrow, no claim step, nothing held in contract storage between sends. 30 tests (unit + fuzz).
- **`backend/`** — thin indexer, Privy identity resolution, keeper cron. Not yet built.
- **`frontend/`** — Next.js app, Privy login, send/receive flow. Not yet built.

## Contracts

```bash
cd contracts
forge build
forge test
```

### Deploy

`script/Deploy.s.sol` reads its config from environment variables so the same script runs unchanged against testnet or mainnet:

| Env var | Purpose |
| --- | --- |
| `USDC_ADDRESS` | Arc USDC address (`0x3600000000000000000000000000000000000000` on testnet) |
| `EURC_ADDRESS` | Arc EURC address (`0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` on testnet) |
| `TREASURY_ADDRESS` | Where protocol fees go |
| `ADMIN_ADDRESS` | Should be a multisig, not an EOA, before any real deployment |
| `FEE_BPS` | Optional, defaults to 50 (0.50%) |
| `MIN_AMOUNT` | Optional, defaults to `1e6` ($1-equivalent) |

```bash
USDC_ADDRESS=0x... EURC_ADDRESS=0x... TREASURY_ADDRESS=0x... ADMIN_ADDRESS=0x... \
  forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --broadcast
```

Arc testnet: chain ID `5042002`, faucet at `faucet.circle.com`, explorer at `testnet.arcscan.app`.

## Status

Contracts are the only piece built so far. Backend and frontend are next.
