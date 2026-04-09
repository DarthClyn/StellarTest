import "dotenv/config";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { enableAllowHttpForInsecureSorobanRpc } from "./allow-http-rpc.js";

enableAllowHttpForInsecureSorobanRpc();

const RESOURCE_SERVER_URL = process.env.RESOURCE_SERVER_URL ?? "http://localhost:3000";
const ENDPOINT_PATH = process.env.ENDPOINT_PATH ?? "/my-service";
const NETWORK = process.env.NETWORK ?? "stellar:testnet";
const STELLAR_PRIVATE_KEY = process.env.STELLAR_PRIVATE_KEY;
const STELLAR_RPC_URL = process.env.STELLAR_RPC_URL ?? "";

if (!STELLAR_PRIVATE_KEY) {
  console.error("STELLAR_PRIVATE_KEY is required. Set it in client/.env.");
  process.exit(1);
}

if (NETWORK === "stellar:pubnet" && !STELLAR_RPC_URL) {
  console.error("STELLAR_RPC_URL is required when NETWORK=stellar:pubnet.");
  process.exit(1);
}

async function main() {
  const url = new URL(ENDPOINT_PATH, RESOURCE_SERVER_URL).toString();
  const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, NETWORK);
  const rpcConfig = STELLAR_RPC_URL ? { url: STELLAR_RPC_URL } : undefined;
  const client = new x402Client().register("stellar:*", new ExactStellarScheme(signer, rpcConfig));
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  console.log(`Target: ${url}\nClient address: ${signer.address}`);
  const firstTry = await fetch(url, { method: "GET" });
  console.log(`Initial response (no payment): ${firstTry.status}`);
  const paidResponse = await fetchWithPayment(url, { method: "GET" });
  const text = await paidResponse.text();
  console.log(`Paid response status: ${paidResponse.status}`);
  let parsedBody;
  try {
    parsedBody = JSON.parse(text);
    console.log("Body:", parsedBody);
  } catch {
    parsedBody = text;
    console.log("Body:", text);
  }
  if (paidResponse.ok) {
    const grantedMessage =
      parsedBody && typeof parsedBody === "object" && "message" in parsedBody
        ? parsedBody.message
        : "Secret valuable content here";
    console.log(`Access Granted! "${grantedMessage}"`);
    const paymentResponse = new x402HTTPClient(client).getPaymentSettleResponse(name =>
      paidResponse.headers.get(name),
    );
    console.log("Payment response:", paymentResponse);
  } else {
    console.log("Paid response headers:", Object.fromEntries(paidResponse.headers.entries()));
  }
}

main().catch(error => {
  console.error("Client failed:", error?.message ?? error);
  process.exit(1);
});
