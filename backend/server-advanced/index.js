import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)), quiet: true });

const app = express();
const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));
const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4022";
const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY;
const PAY_TO =
  process.env.PAY_TO ?? "GA4D33Z3EOB6BU4DOXS2JMZK3JQRABN3ERMF3FK5JF5YPG3CEKRI7WM4";
const PRICE = process.env.PRICE ?? "$0.01";
const NETWORK = process.env.NETWORK ?? "stellar:testnet";
const STELLAR_RPC_URL = process.env.STELLAR_RPC_URL ?? "https://rpc.lightsail.network/";
const ROUTE_PATH = process.env.ROUTE_PATH ?? "/my-service";

if (FACILITATOR_URL.includes("channels.openzeppelin.com") && !FACILITATOR_API_KEY) {
  console.error(
    "FACILITATOR_API_KEY is required when using OpenZeppelin hosted facilitator URL.",
  );
  process.exit(1);
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeJsonForScript(value) {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function formatNetworkLabel(network) {
  if (network === "stellar:testnet") return "Stellar testnet";
  if (network === "stellar:pubnet") return "Stellar pubnet";

  const [chain, env] = (network ?? "").split(":");
  if (chain && env) {
    return `${chain.charAt(0).toUpperCase()}${chain.slice(1)} ${env}`;
  }

  return "Stellar testnet";
}

function amountFromRequirements(paymentRequired) {
  const configured = Number.parseFloat((PRICE || "").replaceAll(/[^0-9.]/g, ""));
  if (!Number.isNaN(configured) && configured > 0) {
    return configured.toFixed(2);
  }

  const first = paymentRequired?.accepts?.[0];

  if (first && typeof first.amount === "string") {
    const raw = Number.parseFloat(first.amount);
    if (!Number.isNaN(raw)) {
      return (raw / 1_000_000).toFixed(2);
    }
  }

  return "0.01";
}

const pageStyles = `
  :root {
    --bg: #f5f5f5;
    --card: #fafafa;
    --text: #18181b;
    --muted: #52525b;
    --line: #e4e4e7;
    --pill: #f0f0f4;
    --accent: #6f62d7;
    --black: #121214;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  a { color: inherit; text-decoration: none; }

  .topbar {
    border-bottom: 1px solid var(--line);
    background: #f3f3f3;
  }

  .topbar-inner {
    width: min(1040px, calc(100% - 32px));
    margin: 0 auto;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .logo-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--pill);
    color: var(--accent);
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 650;
    line-height: 1;
  }

  .btn-dark {
    background: var(--black);
    color: #fff;
  }

  .wrap {
    width: min(1040px, calc(100% - 32px));
    margin: 0 auto;
  }

  .hero {
    text-align: center;
    padding: 76px 0 46px;
  }

  .hero h1 {
    margin: 0;
    font-size: clamp(44px, 7vw, 64px);
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .hero p {
    margin: 18px auto 0;
    max-width: 700px;
    color: var(--muted);
    line-height: 1.55;
    font-size: 16px;
  }

  .hero .btn {
    margin-top: 20px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .card {
    border: 1px solid var(--line);
    background: var(--card);
    border-radius: 8px;
    padding: 18px;
  }

  .card h3 {
    margin: 0 0 8px;
    font-size: 16px;
    letter-spacing: -0.01em;
  }

  .card p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.45;
  }

  section {
    padding: 12px 0 22px;
  }

  section h2 {
    margin: 0 0 14px;
    text-align: center;
    font-size: 32px;
    letter-spacing: -0.03em;
  }

  .steps {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    overflow: hidden;
  }

  .steps li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
    line-height: 1.45;
  }

  .steps li:last-child { border-bottom: 0; }

  .step-num {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 10px;
  }

  .chip {
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 7px 12px;
    background: #fff;
    font-size: 13px;
    color: #3f3f46;
    white-space: nowrap;
  }

  .center-note {
    max-width: 820px;
    margin: 0 auto;
    color: var(--muted);
    text-align: center;
    line-height: 1.55;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 11px;
    border-radius: 999px;
    font-size: 12px;
    color: #3f3f46;
    border: 1px solid var(--line);
    background: #fff;
    margin-bottom: 10px;
  }

  footer {
    margin-top: 26px;
    border-top: 1px solid var(--line);
    text-align: center;
    color: #6b6b76;
    font-size: 12px;
    padding: 20px 0 26px;
  }

  .link {
    color: var(--accent);
    font-weight: 600;
  }

  .demo-wrap {
    padding: 58px 0 36px;
    max-width: 860px;
    margin: 0 auto;
  }

  .back-btn {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: #fafafa;
    color: #666;
    font-size: 18px;
  }

  .demo-wrap h1 {
    margin: 22px 0 14px;
    font-size: clamp(42px, 7vw, 58px);
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .demo-wrap > p {
    margin: 0;
    color: var(--muted);
    line-height: 1.55;
    max-width: 820px;
  }

  .demo-wrap .btn {
    margin-top: 20px;
  }

  .panel {
    margin-top: 28px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    padding: 18px 18px 12px;
  }

  .panel h2 {
    margin: 0 0 8px;
    text-align: left;
    font-size: 38px;
    letter-spacing: -0.03em;
  }

  .panel ul {
    margin: 0;
    padding-left: 20px;
  }

  .panel li {
    margin: 0 0 14px;
    color: #3f3f46;
    line-height: 1.45;
  }

  @media (max-width: 840px) {
    .grid-3,
    .grid-2 {
      grid-template-columns: 1fr;
    }

    .topbar-inner,
    .wrap {
      width: calc(100% - 24px);
    }

    .hero {
      padding-top: 52px;
    }
  }
`;

function renderShell(content) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>x402 on Stellar</title>
        <style>${pageStyles}</style>
      </head>
      <body>
        <header class="topbar">
          <div class="topbar-inner">
            <a href="/" class="brand" aria-label="Stellar x402 home">
              <span>Stellar</span>
              <span class="logo-badge">x402</span>
            </a>
            <a class="btn btn-dark" href="/demo">Try the demo</a>
          </div>
        </header>
        ${content}
      </body>
    </html>
  `;
}

function renderLandingPage() {
  return renderShell(`
    <main class="wrap">
      <section class="hero">
        <h1>x402 <span style="color:#62626e; font-weight: 500;">on Stellar</span></h1>
        <p>
          HTTP-native payments on the Stellar network. This demo shows a working paywall powered by the
          <a class="link" href="https://x402.org" target="_blank" rel="noopener noreferrer">x402 protocol</a>
          and Soroban smart contracts.
        </p>
        <a href="/demo" class="btn btn-dark">Try the demo <span aria-hidden="true">-&gt;</span></a>
      </section>

      <section>
        <div class="grid-3">
          <article class="card">
            <h3>Stellar + USDC</h3>
            <p>
              Payments settle in ~5 seconds on Stellar using Soroban token contracts. This demo uses USDC on
              testnet.
            </p>
          </article>
          <article class="card">
            <h3>HTTPS 402 Protocol</h3>
            <p>
              x402 activates the dormant HTTP 402 status code. Clients pay for resources via request
              headers, no accounts, no OAuth, no subscriptions.
            </p>
          </article>
          <article class="card">
            <h3>Micropayments & AI Agents</h3>
            <p>
              Gate any API or page behind a per-request payment. Designed for both human users and autonomous
              agents.
            </p>
          </article>
        </div>
      </section>

      <section>
        <h2>How x402 Works</h2>
        <ol class="steps">
          <li><span class="step-num">1</span><span>Client requests a protected resource from the server.</span></li>
          <li><span class="step-num">2</span><span>Server responds with <span class="link">HTTP 402</span> and payment requirements (asset, amount, recipient).</span></li>
          <li><span class="step-num">3</span><span>Client builds a Soroban <span class="link">transfer()</span> call, signs the authorization entries, and sends the transaction in the request header.</span></li>
          <li><span class="step-num">4</span><span>Server forwards the payment to a facilitator, which verifies and settles it on Stellar.</span></li>
          <li><span class="step-num">5</span><span>Server returns <span class="link">200 OK</span> with the requested content.</span></li>
        </ol>
      </section>

      <section>
        <h2>Compatible Wallets</h2>
        <p class="center-note">
          x402 on Stellar requires wallets that support <span class="link">auth-entry signing</span>
          (Soroban authorization entry signing).
        </p>
        <div class="chips">
          <span class="chip">Freighter (browser extension) -&gt;</span>
          <span class="chip">Albedo -&gt;</span>
          <span class="chip">Hana -&gt;</span>
          <span class="chip">HOT -&gt;</span>
          <span class="chip">Kiever -&gt;</span>
          <span class="chip">One Key -&gt;</span>
        </div>
      </section>

      <section>
        <h2>Facilitator</h2>
        <div class="center-note">
          <span class="badge">
            <a class="link" href="https://channels.openzeppelin.com/x402" target="_blank" rel="noopener noreferrer">
              channels.openzeppelin.com/x402
            </a>
          </span>
          <p>
            Live OpenZeppelin facilitator sponsors fee free transactions enabling seamless user
            experience on the Stellar network.
          </p>
        </div>
      </section>

      <section>
        <h2>Resources</h2>
        <div class="grid-2">
          <article class="card">
            <h3>Stellar x402 Spec</h3>
            <p>The exact scheme specification for Stellar, defining the protocol flow and facilitator verification rules.</p>
          </article>
          <article class="card">
            <h3>Stellar x402 Docs</h3>
            <p>Official Stellar developer documentation for building x402-enabled apps.</p>
          </article>
          <article class="card">
            <h3>@x402/stellar Package</h3>
            <p>The published npm package for Stellar x402 support across clients, facilitators, and resource servers.</p>
          </article>
          <article class="card">
            <h3>x402 Protocol</h3>
            <p>The x402 protocol by Coinbase - HTTP-native payments for the open web.</p>
          </article>
        </div>
      </section>
    </main>
    <footer>Powered by <span class="link">x402 on Stellar</span></footer>
  `);
}

function renderDemoPage() {
  return renderShell(`
    <main class="wrap">
      <section class="demo-wrap">
        <a href="/" class="btn back-btn" aria-label="Back to home">&lt;-</a>
        <h1>Try the Paywall Demo</h1>
        <p>
          This demo gates a page behind a $0.01 USDC micropayment on Stellar testnet. When you request the
          protected resource, the server returns HTTP 402 with a paywall page where you can sign and submit
          the payment.
        </p>
        <a href="${ROUTE_PATH}" class="btn btn-dark">Access Protected Content <span aria-hidden="true">-&gt;</span></a>

        <article class="panel" aria-labelledby="how-it-works">
          <h2 id="how-it-works">How it works</h2>
          <ol class="steps" style="border:0; background:transparent;">
            <li style="border-bottom:0; padding-left:0; padding-right:0;"><span class="step-num">1</span><span>Click the button below to request the protected resource.</span></li>
            <li style="border-bottom:0; padding-left:0; padding-right:0;"><span class="step-num">2</span><span>The server responds with HTTP 402 and a paywall page. Connect a compatible wallet (e.g. Freighter browser extension).</span></li>
            <li style="border-bottom:0; padding-left:0; padding-right:0;"><span class="step-num">3</span><span>Approve a $0.01 USDC payment on Stellar testnet.</span></li>
            <li style="padding-left:0; padding-right:0;"><span class="step-num">4</span><span>The facilitator verifies and settles the payment on-chain. The content unlocks automatically.</span></li>
          </ol>
        </article>

        <article class="panel" aria-labelledby="prerequisites" style="margin-top:22px;">
          <h2 id="prerequisites">Prerequisites</h2>
          <ul>
            <li>A wallet that supports auth-entry signing (e.g. Freighter browser extension, Albedo, Hana)</li>
            <li>A funded Stellar testnet account with the USDC trustline - to fund it or add a trustline, go to Stellar Laboratory.</li>
            <li>Testnet USDC tokens - get them from the Circle Faucet (select Stellar network)</li>
          </ul>
        </article>
      </section>
    </main>
    <footer>Powered by <span class="link">x402 on Stellar</span></footer>
  `);
}

const customPaywall = {
  generateHtml(paymentRequired) {
    const description = escapeHtml(paymentRequired?.resource?.description || "Access to protected content");
    const amount = escapeHtml(amountFromRequirements(paymentRequired));
    const network = escapeHtml(formatNetworkLabel(paymentRequired?.accepts?.[0]?.network || NETWORK));
    const paywallPayload = serializeJsonForScript(paymentRequired);
    const paywallConfig = serializeJsonForScript({
      stellarRpcUrl: STELLAR_RPC_URL,
    });

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Payment required</title>
          <style>
            :root {
              --bg: #f3f3f5;
              --card: #f7f7f8;
              --text: #1f1f24;
              --muted: #5b5b64;
              --line: #dedee3;
              --black: #111114;
              --link: #6d63d8;
            }

            * { box-sizing: border-box; }

            body {
              margin: 0;
              min-height: 100vh;
              background: var(--bg);
              color: var(--text);
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
              display: grid;
              place-items: start center;
              padding: 95px 16px 24px;
            }

            .paywall {
              width: min(100%, 560px);
              border: 1px solid var(--line);
              border-radius: 10px;
              background: var(--card);
              padding: 16px;
              box-shadow: 0 2px 0 rgba(0, 0, 0, 0.02);
            }

            h1 {
              margin: 0;
              font-size: 44px;
              letter-spacing: -0.035em;
              line-height: 1;
            }

            p {
              margin: 12px 0 0;
              color: var(--muted);
              line-height: 1.5;
              font-size: 14px;
            }

            .fund-link {
              color: var(--link);
              font-weight: 600;
            }

            .details {
              margin-top: 14px;
              border-radius: 8px;
              background: #f1f1f2;
              padding: 12px;
            }

            .row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 6px 0;
              font-size: 13px;
            }

            .label { color: #4f4f57; }
            .value { color: #2f2f35; font-weight: 620; }

            .value.mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 12px;
            }

            .value.wrap {
              max-width: 260px;
              text-align: right;
              word-break: break-all;
            }

            .cta {
              margin-top: 12px;
              width: 100%;
              border: 0;
              border-radius: 8px;
              background: var(--black);
              color: #fff;
              padding: 12px 14px;
              font-weight: 650;
              font-size: 14px;
              cursor: pointer;
            }

            .cta:disabled {
              cursor: progress;
              opacity: 0.7;
            }

            .status {
              margin-top: 12px;
              border-radius: 8px;
              padding: 10px 12px;
              font-size: 13px;
              line-height: 1.45;
              background: #efeff3;
              color: #42424a;
            }

            .status[data-state="error"] {
              background: #fee2e2;
              color: #991b1b;
            }

            .status[data-state="success"] {
              background: #dcfce7;
              color: #166534;
            }

            .result {
              margin-top: 12px;
              border-radius: 8px;
              background: #101114;
              color: #f4f4f5;
              padding: 12px;
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 12px;
              line-height: 1.5;
              overflow-x: auto;
              white-space: pre-wrap;
            }

            .helper {
              margin-top: 10px;
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <main class="paywall">
            <h1>Payment required</h1>
            <p>
              ${description}. To access this content, please pay $${amount} ${network} USDC.
              <a class="fund-link" href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">Fund USDC -&gt;</a>
            </p>

            <div class="details">
              <div class="row"><span class="label">Wallet:</span><span class="value mono wrap" data-wallet-value>Not connected</span></div>
              <div class="row"><span class="label">Wallet network:</span><span class="value" data-network-value>Not connected</span></div>
              <div class="row"><span class="label">Amount:</span><span class="value">$${amount} USDC</span></div>
              <div class="row"><span class="label">Network:</span><span class="value">${network}</span></div>
            </div>

            <button class="cta" id="paywall-action" type="button">Connect Freighter and pay</button>
            <div class="status" id="paywall-status">Use the Freighter browser extension to sign the Stellar auth entry and unlock this response.</div>
            <pre class="result" id="paywall-result" hidden></pre>
            <p class="helper">If you are paying on pubnet, make sure Freighter is set to the same network and has a Soroban RPC endpoint configured.</p>
          </main>
          <script id="payment-required-data" type="application/json">${paywallPayload}</script>
          <script id="paywall-config-data" type="application/json">${paywallConfig}</script>
          <script type="module" src="/paywall-client.js"></script>
        </body>
      </html>
    `;
  },
};

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.type("html").send(renderLandingPage());
});

app.get("/demo", (req, res) => {
  res.type("html").send(renderDemoPage());
});

const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  createAuthHeaders: FACILITATOR_API_KEY
    ? async () => ({
        verify: { Authorization: `Bearer ${FACILITATOR_API_KEY}` },
        settle: { Authorization: `Bearer ${FACILITATOR_API_KEY}` },
        supported: { Authorization: `Bearer ${FACILITATOR_API_KEY}` },
      })
    : undefined,
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactStellarScheme(),
);

app.use(
  paymentMiddleware(
    {
      [`GET ${ROUTE_PATH}`]: {
        accepts: {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
        },
        description: "Access to protected content",
        mimeType: "application/json",
      },
    },
    resourceServer,
    undefined,
    customPaywall,
  ),
);

app.get(ROUTE_PATH, (req, res) => {
  res.json({
    message: "Secret valuable content here",
    network: NETWORK,
    payTo: PAY_TO,
    facilitator: FACILITATOR_URL,
  });
});

app.listen(PORT, () => {
  console.log(`x402 demo server listening on http://localhost:${PORT}`);
  console.log(`Route: GET http://localhost:${PORT}${ROUTE_PATH}`);
  console.log(`Landing: GET http://localhost:${PORT}/`);
  console.log(`Demo: GET http://localhost:${PORT}/demo`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Receiver: ${PAY_TO}`);
});
