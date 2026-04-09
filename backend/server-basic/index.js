import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const PORT = "3001";
const ROUTE_PATH = "/my-service";
const PRICE = "$0.01";
const NETWORK = "stellar:testnet";
const FACILITATOR_URL = "https://www.x402.org/facilitator";
const PAY_TO = "GA4D33Z3EOB6BU4DOXS2JMZK3JQRABN3ERMF3FK5JF5YPG3CEKRI7WM4";

const app = express();
app.get("/", (_, res) => res.json({ route: ROUTE_PATH, price: PRICE, network: NETWORK }));
app.use(
  paymentMiddlewareFromConfig(
    {
      [`GET ${ROUTE_PATH}`]: {
        accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: PAY_TO },
      },
    },
    new HTTPFacilitatorClient({url: FACILITATOR_URL}),
    [{ network: NETWORK, server: new ExactStellarScheme() }],
  ),
);
app.get(ROUTE_PATH, (_, res) => res.json({ secret: `valuable content` }));
app.listen(Number(PORT), () =>
  console.log(`x402 server listening on http://localhost:${PORT}${ROUTE_PATH}`),
);
