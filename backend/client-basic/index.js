import dotenv from "dotenv";
import { Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer, getNetworkPassphrase } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)), quiet: true });

const STELLAR_PRIVATE_KEY = process.env.STELLAR_PRIVATE_KEY;
const RESOURCE_SERVER_URL = "http://localhost:3001";
const ENDPOINT_PATH = "/my-service";
const NETWORK = "stellar:testnet";
const STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";

async function main() {
  const url = new URL(ENDPOINT_PATH, RESOURCE_SERVER_URL).toString();
  const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, NETWORK);
  const rpcConfig = STELLAR_RPC_URL ? { url: STELLAR_RPC_URL } : undefined;
  const client = new x402Client().register("stellar:*", new ExactStellarScheme(signer, rpcConfig));
  const httpClient = new x402HTTPClient(client);
  console.log(`Target: ${url}\nClient address: ${signer.address}`);
  const firstTry = await fetch(url, { method: "GET" });
  console.log(`Payment requested: ${firstTry.status}`);
  const paymentRequired = httpClient.getPaymentRequiredResponse(name => firstTry.headers.get(name));
  let paymentPayload = await client.createPaymentPayload(paymentRequired);
  const networkPassphrase = getNetworkPassphrase(NETWORK);
  const tx = new Transaction(paymentPayload.payload.transaction, networkPassphrase);
  const sorobanData = tx.toEnvelope().v1()?.tx()?.ext()?.sorobanData();
  if (sorobanData) {
    paymentPayload = {
      ...paymentPayload,
      payload: {
        ...paymentPayload.payload,
        transaction: TransactionBuilder.cloneFrom(tx, {
          fee: "1", // 0 not valid, fee sponsored by facilitator
          sorobanData,
          networkPassphrase,
        }).build().toXDR(),
      },
    };
  }
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
  const paidResponse = await fetch(url, { method: "GET", headers: paymentHeaders });
  const text = await paidResponse.text();
  const paymentResponse = httpClient.getPaymentSettleResponse(name => paidResponse.headers.get(name));
  console.log("Settlement response:", paymentResponse);
  console.log(`Access Granted! ${paidResponse.status} "${text}"`);
}

main().catch(error => {
  console.error("Client failed:", error);
  process.exit(1);
});
