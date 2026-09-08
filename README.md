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

The private key is deliberately not one of the env vars — supply it only at deploy time, never persisted to disk:

```bash
source .env  # loads USDC_ADDRESS, EURC_ADDRESS, TREASURY_ADDRESS, ADMIN_ADDRESS, etc.
forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --broadcast --interactive
```

`--interactive` prompts for the private key at runtime — it's never written to a file or shell history. For repeated deploys, `cast wallet import <name> --interactive` once to create a local encrypted keystore, then use `--account <name>` instead of `--interactive` on future runs.

Arc testnet: chain ID `5042002`, faucet at `faucet.circle.com`, explorer at `testnet.arcscan.app`.

### Deployed (Arc testnet)

| | |
| --- | --- |
| Address | [`0x75E4Eb5F40c48e89e0FDA6e32E88459F5d97183D`](https://testnet.arcscan.app/address/0x75E4Eb5F40c48e89e0FDA6e32E88459F5d97183D) |
| Status | Verified on Blockscout |
| Allowed tokens | USDC, EURC |
| Fee | 0.50% |
| Min send | $1-equivalent |

## Status

Contracts deployed and verified on Arc testnet. Backend and frontend are next.
