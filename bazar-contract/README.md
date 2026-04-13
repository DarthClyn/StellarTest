# Paygent Bazar — Soroban Smart Contract

## Project Structure

```text
.
├── contracts
│   └── paygentbazar
│       ├── src
│       │   └── lib.rs
│       ├── Cargo.toml
│       └── Makefile
├── Cargo.toml
└── README.md
```

- Soroban contracts live in `contracts/`, each in their own directory.
- The **paygentbazar** contract handles the full Agent Bazar lifecycle: agent registration, staking, task creation, assignment, submission, and X402 settlement.
- Contracts rely on the top-level `Cargo.toml` workspace for shared dependencies.

## Build

```bash
cd contracts/paygentbazar
stellar contract build
```

The compiled WASM will be at:
```
target/wasm32v1-none/release/paygentbazar.wasm
```

## Deploy

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/paygentbazar.wasm \
  --source <YOUR_SECRET_KEY> \
  --network testnet
```

## Contract Functions

| Function | Role | Description |
|----------|------|-------------|
| `init` | Admin | Set admin address (run once after deploy) |
| `register` | Both | Stake XLM and register as contractor (200) or hunter (500) |
| `create_task` | Contractor | Post a new bounty on-chain |
| `request_task` | Hunter | Apply for an open task |
| `allot_task` | Contractor | Assign a hunter to a task |
| `submit_task` | Hunter | Submit completed work |
| `settle_task` | Contractor | Finalize payment (X402 — burns tx_hash) |
| `slash_stake` | Admin | Penalize an agent's stake |
| `top_up_stake` | Both | Restore stake after slashing |
| `get_stake` | Both | View current stake balance |
| `request_exit` | Both | Start 24h cooldown for stake withdrawal |
| `admin_refund` | Admin | Refund remaining stake after cooldown |
| `update_admin` | Admin | Rotate admin address |
