// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { paymentMiddlewareFromConfig } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactStellarScheme } = require('@x402/stellar/exact/server');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// In-memory state
const tasks = [];
const logs = [];

// Utility: Add log and keep max 100
function addLog(msg) {
  logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (logs.length > 100) logs.shift();
}

// API: Get all tasks
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

// API: Get all logs
app.get('/api/logs', (req, res) => {
  res.json(logs);
});

// Agent B: Quote endpoint
app.post('/api/agent-b/quote', (req, res) => {
  const task = req.body;
  if (!task || !task.category) {
    addLog('Agent B received invalid task for quote.');
    return res.status(400).json({ error: 'Invalid task' });
  }
  if (task.category === 'image generation') {
    addLog('Agent B reviewed task. Category matches. Quoted: 0.2 USDC.');
    return res.json({ accepted: true, quote: 0.2, currency: 'USDC' });
  } else {
    addLog('Agent B reviewed task. Category not supported. Rejected.');
    return res.json({ accepted: false, reason: 'Category not supported' });
  }
});

// Real x402 middleware configuration
const x402Middleware = paymentMiddlewareFromConfig(
  {
    "POST /api/agent-b/execute": { 
      accepts: { 
        scheme: "exact", 
        price: "0.20", // 0.20 USDC
        network: "stellar:testnet", 
        payTo: "GBWZGSPD2LTKJFCO3NY6KNZKH7LGZXJYEZQ3UITZWKSYBTCE7UWNO4OM" // Your Real Public Key
      } 
    },
  },
  new HTTPFacilitatorClient({ url: "https://www.x402.org/facilitator" }),
  [{ network: "stellar:testnet", server: new ExactStellarScheme() }]
);
// Agent B: Execute endpoint (protected by x402)
app.post('/api/agent-b/execute', x402Middleware, (req, res) => {
  let realTxHash = "Hash not found by server";

  // Method 1: Check the specific x402Payment object injected by the SDK
  const paymentDetails = req.x402Payment || req.paymentContext || {};
  if (paymentDetails.transactionHash || paymentDetails.txHash) {
    realTxHash = paymentDetails.transactionHash || paymentDetails.txHash;
  }

  // Method 2: Check the Response headers (The middleware often attaches it here!)
  if (realTxHash === "Hash not found by server") {
    const responseHeader = res.getHeader('payment-response') || res.getHeader('x-payment-response');
    if (responseHeader) {
      try {
        // The facilitator receipt is base64 encoded in the header
        const decodedReceipt = JSON.parse(Buffer.from(responseHeader, 'base64').toString());
        realTxHash = decodedReceipt.receipt?.transactionHash || decodedReceipt.transactionHash || decodedReceipt.id;
      } catch (e) {
        console.log("[Agent B] Found response header but couldn't decode.");
      }
    }
  }

  addLog(`Payment of 0.2 USDC verified!`);
  addLog(`Agent B executed task. Real Hash: ${realTxHash}`);
  
  res.json({
    result: 'Task executed by Agent B',
    txHash: realTxHash,
  });
});


// API: Add new task (for Agent A)
app.post('/api/tasks', (req, res) => {
  const task = req.body;
  if (!task || !task.id || !task.category) {
    return res.status(400).json({ error: 'Invalid task' });
  }
  tasks.push(task);
  addLog(`Agent A posted a new task: ${task.category}.`);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Backend/Agent B listening on http://localhost:${PORT}`);
});
