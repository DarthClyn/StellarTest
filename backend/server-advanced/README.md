# x402 Stellar Demo Server

Express API protected by x402 middleware.

## Setup

```bash
cp .env.example .env
```

## Environment Variables

- `PORT` (default: `3000`)
- `ROUTE_PATH` (default: `/my-service`)
- `PRICE` (default: `$0.01`)
- `PAY_TO` (required for real settlement)
- `NETWORK` (default: `stellar:testnet`)
- `FACILITATOR_URL` (default: `http://localhost:4022`, expected to point at your own facilitator or a hosted one)
- `FACILITATOR_API_KEY` (required when `FACILITATOR_URL` is OpenZeppelin hosted URL, sent as `Authorization: Bearer <key>`)
- `STELLAR_RPC_URL` (optional fallback Soroban RPC URL for the browser paywall; recommended on `stellar:pubnet`)

## Run

```bash
pnpm --filter server start
```

## Endpoints

- `GET /my-service` (x402 protected by default route config)
