# x402 Stellar Basic Server

Minimal Express server protected by x402 middleware.

## Setup

```bash
cp .env.example .env
```

## Environment Variables

- `PORT` (default: `3001`)
- `ROUTE_PATH` (default: `/protected`)
- `PRICE` (default: `$0.01`)
- `PAY_TO` (required for real settlement)
- `NETWORK` (default: `stellar:testnet`)
- `FACILITATOR_URL` (default: `http://localhost:4022`)
- `FACILITATOR_API_KEY` (required when `FACILITATOR_URL` is OpenZeppelin hosted)

## Run

```bash
pnpm --filter server-basic start
```

## Endpoints

- `GET /` returns a plain JSON hint about the protected route
- `GET /protected` is x402-protected by default
