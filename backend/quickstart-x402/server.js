import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

// Set up configuration
const PORT = "3001";
const ROUTE_PATH = "/my-service";
const PRICE = "$0.01"; // price in USDC
const NETWORK = "stellar:testnet"; // Use pubnet for mainnet
const FACILITATOR_URL = "https://www.x402.org/facilitator";
const PAY_TO = "GDF6YNOS4B7CX5BL3BIZFVJYOZIOL6B22RRRTBVUYTCE2TXONP5V5NHO"; // Add Stellar Address

const app = express();

// Return information for /
app.get("/", (_, res) =>
  res.json({ route: ROUTE_PATH, price: PRICE, network: NETWORK }),
);

// Create x402 middleware config
app.use(
  paymentMiddlewareFromConfig(
    {
      [`GET ${ROUTE_PATH}`]: {
        accepts: {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
        },
      },
    },
    new HTTPFacilitatorClient({ url: FACILITATOR_URL }),
    [{ network: NETWORK, server: new ExactStellarScheme() }],
  ),
);

// Attach x402 middleware config
app.get(ROUTE_PATH, (_, res) => res.json({ secret: "valuable content" }));

// Start server
app.listen(Number(PORT), () => {
  console.log(`x402 server listening on http://localhost:${PORT}${ROUTE_PATH}`);
});