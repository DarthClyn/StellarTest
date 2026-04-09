import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactStellarScheme, getNetworkPassphrase } from "@x402/stellar";
import { getNetworkDetails, isConnected, requestAccess, signAuthEntry } from "@stellar/freighter-api";
import { enableAllowHttpForInsecureSorobanRpc } from "./allow-http-rpc.js";

enableAllowHttpForInsecureSorobanRpc();

const actionButton = document.getElementById("paywall-action");
const statusElement = document.getElementById("paywall-status");
const resultElement = document.getElementById("paywall-result");
const walletValueElement = document.querySelector("[data-wallet-value]");
const networkValueElement = document.querySelector("[data-network-value]");
const paymentRequiredElement = document.getElementById("payment-required-data");
const paywallConfigElement = document.getElementById("paywall-config-data");

if (
  actionButton &&
  statusElement &&
  resultElement &&
  walletValueElement &&
  networkValueElement &&
  paymentRequiredElement
) {
  initializePaywall().catch(error => {
    setStatus(error?.message ?? "Failed to initialize the paywall.", "error");
  });
}

async function initializePaywall() {
  const paymentRequired = readJsonElement(paymentRequiredElement);
  const paywallConfig = paywallConfigElement ? readJsonElement(paywallConfigElement) : {};
  const requiredPayment = paymentRequired?.accepts?.[0];

  if (!requiredPayment?.network) {
    throw new Error("Missing Stellar payment requirements on this page.");
  }

  const requiredNetworkPassphrase = getNetworkPassphrase(requiredPayment.network);

  actionButton.addEventListener("click", async () => {
    try {
      setBusy(true, "Connecting to Freighter...");
      const address = await connectWallet();
      const { networkDetails, rpcUrl } = await resolveWalletNetwork(
        requiredPayment.network,
        requiredNetworkPassphrase,
        paywallConfig,
      );

      setStatus("Preparing payment payload...");

      const signer = {
        address,
        async signAuthEntry(authEntryXdr, opts = {}) {
          const response = await signAuthEntry(authEntryXdr, {
            address,
            networkPassphrase: opts.networkPassphrase || requiredNetworkPassphrase,
          });

          if (response.error || !response.signedAuthEntry) {
            throw new Error(response.error?.message || "Freighter did not sign the auth entry.");
          }

          return response;
        },
      };

      const client = new x402Client().register(
        "stellar:*",
        new ExactStellarScheme(signer, rpcUrl ? { url: rpcUrl } : undefined),
      );
      const httpClient = new x402HTTPClient(client);

      const paymentPayload = await client.createPaymentPayload(paymentRequired);
      const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

      setStatus("Submitting payment to unlock the response...");

      const response = await fetch(window.location.href, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...paymentHeaders,
        },
      });

      if (!response.ok) {
        throw new Error(await describeHttpFailure(response));
      }

      const settleResponse = safelyGetSettlementResponse(httpClient, response);
      await renderPaidResponse(response, settleResponse, networkDetails);

      actionButton.disabled = true;
      actionButton.textContent = "Unlocked";
      setStatus("Payment settled successfully. Protected content unlocked.", "success");
    } catch (error) {
      setStatus(error?.message ?? "Payment failed.", "error");
      setBusy(false, "Connect Freighter and pay");
    }
  });
}

async function connectWallet() {
  const connection = await isConnected();

  if (connection.error) {
    throw new Error(connection.error.message || "Unable to detect Freighter.");
  }

  if (!connection.isConnected) {
    throw new Error("Freighter was not detected. Install the extension and reload this page.");
  }

  const access = await requestAccess();

  if (access.error || !access.address) {
    throw new Error(access.error?.message || "Freighter access was not granted.");
  }

  walletValueElement.textContent = shortenAddress(access.address);
  return access.address;
}

async function resolveWalletNetwork(requiredNetwork, requiredNetworkPassphrase, paywallConfig) {
  const networkDetails = await getNetworkDetails();

  if (networkDetails.error) {
    throw new Error(networkDetails.error.message || "Unable to read Freighter network details.");
  }

  if (
    networkDetails.networkPassphrase &&
    networkDetails.networkPassphrase !== requiredNetworkPassphrase
  ) {
    const currentNetwork = networkDetails.networkName || networkDetails.network || "another network";
    throw new Error(`Freighter is on ${currentNetwork}. Switch it to ${requiredNetwork} and try again.`);
  }

  networkValueElement.textContent = networkDetails.networkName || requiredNetwork;

  const rpcUrl = paywallConfig?.stellarRpcUrl || networkDetails.sorobanRpcUrl || "";

  if (requiredNetwork === "stellar:pubnet" && !rpcUrl) {
    throw new Error(
      "A Soroban RPC URL is required for stellar:pubnet. Set STELLAR_RPC_URL on the server or configure Freighter with a pubnet RPC endpoint.",
    );
  }

  return { networkDetails, rpcUrl };
}

async function renderPaidResponse(response, settleResponse, networkDetails) {
  const contentType = response.headers.get("content-type") || "";
  let output;

  if (contentType.includes("application/json")) {
    output = JSON.stringify(await response.json(), null, 2);
  } else {
    output = await response.text();
  }

  if (settleResponse?.transaction) {
    output = `${output}\n\nSettlement transaction: ${settleResponse.transaction}`;
  }

  if (networkDetails?.networkName) {
    output = `${output}\n\nWallet network: ${networkDetails.networkName}`;
  }

  resultElement.hidden = false;
  resultElement.textContent = output;
}

async function describeHttpFailure(response) {
  let detail = `Request failed with HTTP ${response.status}.`;

  try {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await response.json();
      if (body?.error) {
        detail = `${detail} ${body.error}`;
      }
    } else {
      const text = (await response.text()).trim();
      if (text) {
        detail = `${detail} ${text.slice(0, 240)}`;
      }
    }
  } catch {
    return detail;
  }

  return detail;
}

function safelyGetSettlementResponse(httpClient, response) {
  try {
    return httpClient.getPaymentSettleResponse(name => response.headers.get(name));
  } catch {
    return null;
  }
}

function readJsonElement(element) {
  if (!element?.textContent) {
    return {};
  }

  return JSON.parse(element.textContent);
}

function setBusy(isBusy, label) {
  actionButton.disabled = isBusy;
  actionButton.textContent = label;
}

function setStatus(message, state = "idle") {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function shortenAddress(address) {
  if (typeof address !== "string" || address.length < 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}
