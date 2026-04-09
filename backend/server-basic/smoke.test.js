import assert from "node:assert/strict";
import test from "node:test";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import {
  ExactStellarScheme as ServerExactStellarScheme,
  STELLAR_TESTNET_CAIP2,
  validateStellarDestinationAddress,
} from "@x402/stellar";

const PAY_TO = "GA4D33Z3EOB6BU4DOXS2JMZK3JQRABN3ERMF3FK5JF5YPG3CEKRI7WM4";

test("basic server middleware constructs cleanly", () => {
  assert.equal(validateStellarDestinationAddress(PAY_TO), true);

  const facilitatorClient = new HTTPFacilitatorClient({
    url: "http://localhost:4022",
  });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    STELLAR_TESTNET_CAIP2,
    new ServerExactStellarScheme(),
  );

  const middleware = paymentMiddleware(
    {
      "GET /protected": {
        accepts: {
          scheme: "exact",
          price: "$0.01",
          network: STELLAR_TESTNET_CAIP2,
          payTo: PAY_TO,
        },
        description: "Access the protected tutorial response",
        mimeType: "application/json",
      },
    },
    resourceServer,
    undefined,
    undefined,
    false,
  );

  assert.equal(typeof middleware, "function");
});
