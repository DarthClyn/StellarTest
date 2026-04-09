# x402 Stellar Demo

Local x402 demo for Stellar with four runnable examples:

- `server-basic`: smallest protected Express server
- `client-basic`: lowest-level Node client that handles the `402` flow manually
- `server-advanced`: fuller server demo with browser paywall assets and extra config
- `client-advanced`: configurable client that wraps `fetch` and retries with payment automatically

## Basic vs Advanced

The basic examples are the smallest possible building blocks. They are useful when you want to understand the x402 request and payment flow with minimal code and minimal configuration.

The advanced examples are closer to a real demo setup. They add more environment-based configuration, pubnet support details, and, on the server side, a browser paywall flow that works with Freighter.

## Prerequisites

- Node.js `20+`
- `pnpm`

## Server Basic

Use `server-basic` when you want the simplest protected API.

1. Install dependencies:

```bash
cd server-basic
pnpm install
```

2. Optionally create `server-basic/.env` if you want to override defaults:

```dotenv
PORT=3001
ROUTE_PATH=/my-service
PRICE=$0.01
NETWORK=stellar:testnet
FACILITATOR_URL=https://www.x402.org/facilitator
PAY_TO=YOUR_STELLAR_PUBLIC_KEY
```

3. Start the server:

```bash
cd server-basic
pnpm start
```

By default it serves `GET /` and protects `GET /my-service`.

## Client Basic

Use `client-basic` when you want to see the payment flow handled more explicitly in code.

1. Install dependencies:

```bash
cd client-basic
pnpm install
```

2. Create the env file:

```bash
cp client-basic/.env.example client-basic/.env
```

3. Set your Stellar secret in `client-basic/.env`:

```dotenv
STELLAR_PRIVATE_KEY=YOUR_STELLAR_SECRET
```

4. Start the client:

```bash
cd client-basic
pnpm start
```

`client-basic` is currently wired to `http://localhost:3001/my-service` on `stellar:testnet`.

## Server Advanced

Use `server-advanced` when you want the fuller demo server, including the browser paywall assets and pubnet-oriented configuration.

1. Install dependencies:

```bash
cd server-advanced
pnpm install
```

2. Create the env file:

```bash
cp server-advanced/.env.example server-advanced/.env
```

3. Update `server-advanced/.env` for your network and payment destination. Example testnet config:

```dotenv
PORT=3000
ROUTE_PATH=/my-service
PRICE=$0.01
NETWORK=stellar:testnet
FACILITATOR_URL=http://localhost:4022
STELLAR_RPC_URL=
FACILITATOR_API_KEY=
PAY_TO=YOUR_STELLAR_PUBLIC_KEY
```

Example pubnet config:

```dotenv
PORT=3000
ROUTE_PATH=/my-service
PRICE=$0.01
NETWORK=stellar:pubnet
FACILITATOR_URL=https://channels.openzeppelin.com/x402
STELLAR_RPC_URL=YOUR_SOROBAN_RPC_URL
FACILITATOR_API_KEY=YOUR_OPENZEPPELIN_API_KEY
PAY_TO=YOUR_STELLAR_PUBLIC_KEY
```

4. Start the server:

```bash
cd server-advanced
pnpm start
```

This starts the protected API on `GET /my-service` and builds the browser paywall bundle before launching.

## Client Advanced

Use `client-advanced` when you want a configurable Node client that automatically retries paid requests.

1. Install dependencies:

```bash
cd client-advanced
pnpm install
```

2. Create the env file:

```bash
cp client-advanced/.env.example client-advanced/.env
```

3. Update `client-advanced/.env`:

```dotenv
RESOURCE_SERVER_URL=http://localhost:3000
ENDPOINT_PATH=/my-service
NETWORK=stellar:testnet
STELLAR_RPC_URL=
STELLAR_PRIVATE_KEY=YOUR_STELLAR_SECRET
```

For pubnet, keep `RESOURCE_SERVER_URL` and `ENDPOINT_PATH` the same, set `NETWORK=stellar:pubnet`, and provide `STELLAR_RPC_URL`.

4. Start the client:

```bash
cd client-advanced
pnpm start
```

The script shows the initial unpaid response, the paid retry, the response body, and the payment settlement headers.

## Notes

- Keep client and server on the same network: `stellar:testnet` or `stellar:pubnet`.
- `PAY_TO` must be a valid Stellar public key for real settlement.
- Do not commit `.env` files with secrets.
