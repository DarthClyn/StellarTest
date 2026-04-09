# x402 Stellar Demo Client

Node.js client that calls the protected endpoint and retries automatically with x402 payment.

## Setup

```bash
cp .env.example .env
```

## Environment Variables

- `RESOURCE_SERVER_URL` (default: `http://localhost:3000`)
- `ENDPOINT_PATH` (default: `/my-service`)
- `NETWORK` (default: `stellar:testnet`)
- `STELLAR_RPC_URL` (required on `stellar:pubnet`, optional on `stellar:testnet`)
- `STELLAR_PRIVATE_KEY` (required)

## Run

```bash
pnpm --filter client start
```

The script prints:
1. Initial request status (expected `402`).
2. Paid retry status.
3. Response body.
4. Payment settle response header if payment succeeds.
