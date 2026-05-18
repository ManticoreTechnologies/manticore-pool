# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is **EPSS** (Evrmore Personal Stratum Server) — a Node.js mining pool/stratum server for the Evrmore (EVR) cryptocurrency. It has two main components:

1. **Express API/Dashboard** (port 3000) — REST API and web UI for pool stats, workers, blocks, network info.
2. **Stratum Server** (ports 3333, 3334) — TCP protocol server that miners connect to.

### Prerequisites

- **Node.js >= 12** (the VM has v22 which works fine)
- **npm** as the package manager (`package-lock.json` is committed)
- **Evrmore config file** at `~/.evrmore/evrmore.conf` with at least `rpcuser` and `rpcpassword` set. Without this, the app emits a warning but still starts the Express API.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Syntax check (lint equivalent) | `npm run check` |
| Start (mainnet) | `npm start` |
| Start (testnet) | `npm run start:testnet` |

### Running without evrmored

The pool's stratum component requires a running Evrmore full node (`evrmored`) for RPC communication. Without it:
- The Express API/dashboard **still starts** on port 3000 and serves all `/api/*` endpoints.
- The stratum server (ports 3333/3334) **will not start** — you'll see an error like `"Could not start pool, error with init batch RPC call: ECONNREFUSED"`.
- The `/api/health` endpoint returns `{"ok": false}` when the daemon is unreachable.

This is expected in dev environments without a blockchain node. The API and dashboard are fully testable without `evrmored`.

### Environment variables

The app reads RPC config from either `~/.evrmore/evrmore.conf` or environment variables. Key vars:
- `EVR_RPC_URL` — full RPC endpoint (e.g. `http://user:pass@host:8819`)
- `EVR_RPC_HOST`, `EVR_RPC_PORT`, `EVR_RPC_USER`, `EVR_RPC_PASSWORD` — individual pieces
- `EVRMORE_CONF` — path to evrmore.conf file
- `POOL_ADDRESS` — pool payout address
- `API_PORT` (default 3000), `API_HOST` (default 0.0.0.0)

### Project structure

- `server.js` — main entry point (Express + Stratum)
- `config.js` / `config.dev.js` — pool configuration (mainnet / testnet)
- `lib/` — stratum protocol implementation (pool, jobManager, stratum, transactions, etc.)
- `utility/utils.js` — config file parsing and RPC helpers
- `public/` — static frontend dashboard (HTML/CSS/JS)
- `data/pool-state.json` — persisted pool state (auto-created)

### Notes for future agents

- There is **no test framework** configured in this project. The only automated check is `npm run check` (Node.js syntax validation).
- There is **no ESLint** or other linter configured.
- The `data/` directory must exist for pool state persistence; it's auto-created by the app if missing.
- To create `~/.evrmore/evrmore.conf` for dev: `mkdir -p ~/.evrmore && echo -e "rpcuser=devuser\nrpcpassword=devpassword\nminingaddress=EcmFc6abS8xPkMpzWrZSo9yEU2jgcDhkzd" > ~/.evrmore/evrmore.conf`
