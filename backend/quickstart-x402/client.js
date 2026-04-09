import dotenv from "dotenv";
import { Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer, getNetworkPassphrase } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { fileURLToPath } from "node:url";

// Load environment variables
dotenv.config({
  path: fileURLToPath(new URL("./.env", import.meta.url)),
  quiet: true,
});

// Set up configuration
const STELLAR_PRIVATE_KEY = process.env.STELLAR_PRIVATE_KEY;
const RESOURCE_SERVER_URL = "http://localhost:3001"; // host and port
const ENDPOINT_PATH = "/my-service";
const NETWORK = "stellar:testnet"; // use pubnet for mainnet
const STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";

async function main() {
  // Setup x402Client configuration
  const url = new URL(ENDPOINT_PATH, RESOURCE_SERVER_URL).toString();
  const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, NETWORK);
  const rpcConfig = STELLAR_RPC_URL ? { url: STELLAR_RPC_URL } : undefined;
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer, rpcConfig),
  );
  const httpClient = new x402HTTPClient(client);
  console.log(`Target: ${url}\nClient address: ${signer.address}`);

  // Try without payment
  const firstTry = await fetch(url);
  console.log(`Payment requested: ${firstTry.status}`);
  // Grab response which includes instructions for payment
  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    firstTry.headers.get(name),
  );
  // Create payment payload
  let paymentPayload = await client.createPaymentPayload(paymentRequired);
  const networkPassphrase = getNetworkPassphrase(NETWORK);
  const tx = new Transaction(
    paymentPayload.payload.transaction,
    networkPassphrase,
  );
  const sorobanData = tx.toEnvelope().v1()?.tx()?.ext()?.sorobanData();
  // Configure fee to 1 stroop, prevents testnet facilitator limit issue
  if (sorobanData) {
    paymentPayload = {
      ...paymentPayload,
      payload: {
        ...paymentPayload.payload,
        transaction: TransactionBuilder.cloneFrom(tx, {
          fee: "1",
          sorobanData,
          networkPassphrase,
        })
          .build()
          .toXDR(),
      },
    };
  }
  const paymentHeaders =
    httpClient.encodePaymentSignatureHeader(paymentPayload);
  // Send request
  const paidResponse = await fetch(url, {
    method: "GET",
    headers: paymentHeaders,
  });
  const text = await paidResponse.text();
  const paymentResponse = httpClient.getPaymentSettleResponse((name) =>
    paidResponse.headers.get(name),
  );
  // Log response
  console.log("Settlement response:", paymentResponse);
  console.log(`Access Granted! ${paidResponse.status} "${text}"`);
}

main().catch((error) => {
  console.error("Client failed:", error);
  process.exit(1);
});