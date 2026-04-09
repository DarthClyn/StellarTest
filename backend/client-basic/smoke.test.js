import assert from "node:assert/strict";
import test from "node:test";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import {
  ExactStellarScheme as ClientExactStellarScheme,
} from "@x402/stellar/exact/client";
import {
  STELLAR_TESTNET_CAIP2,
  getNetworkPassphrase,
  getUsdcAddress,
} from "@x402/stellar";

const mockSigner = {
  address: "GA4D33Z3EOB6BU4DOXS2JMZK3JQRABN3ERMF3FK5JF5YPG3CEKRI7WM4",
  async signAuthEntry() {
    throw new Error("not used in smoke test");
  },
  async signTransaction() {
    throw new Error("not used in smoke test");
  },
};

test("published npm stellar client packages construct cleanly", () => {
  const client = new x402Client().register(
    "stellar:*",
    new ClientExactStellarScheme(mockSigner),
  );

  const httpClient = new x402HTTPClient(client);
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  assert.equal(typeof fetchWithPayment, "function");
  assert.ok(httpClient);
  assert.equal(
    getNetworkPassphrase(STELLAR_TESTNET_CAIP2),
    "Test SDF Network ; September 2015",
  );
  assert.match(getUsdcAddress(STELLAR_TESTNET_CAIP2), /^C[A-Z2-7]{55}$/);
});
