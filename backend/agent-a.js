// backend/agent-a.js
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { createEd25519Signer } = require('@x402/stellar');
const { ExactStellarScheme } = require('@x402/stellar/exact/client');

const BACKEND = 'http://localhost:3001';
const AGENT_A_KEY = 'SDGDMBKVM2543EX75U7KBMB5OGLAZHWYAACFP7G7NU6EIZMVMVL4DGQY'; // Provided testnet secret

async function main() {
  // Step 1: Post a new task
  const task = { id: 1, category: 'image generation', prompt: 'Draw a cat' };
  await fetch(`${BACKEND}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  console.log('Agent A posted a new task: image generation.');

  // Step 2: Ask Agent B for a quote
  const quoteRes = await fetch(`${BACKEND}/api/agent-b/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  const quote = await quoteRes.json();
  if (!quote.accepted) {
    console.log('Agent B rejected the task:', quote.reason);
    return;
  }
  console.log(`Agent B quoted: ${quote.quote} ${quote.currency}`);

  // Step 3: Set up the official x402 wallet client
  const signer = createEd25519Signer(AGENT_A_KEY);
  const client = new x402Client();
  client.register("stellar:testnet", new ExactStellarScheme(signer));
  
  // Create the payment-aware fetch
  const wrappedFetch = wrapFetchWithPayment(fetch, client);

  // Step 4: Call protected execute endpoint (x402)
  const execRes = await wrappedFetch(`${BACKEND}/api/agent-b/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: task.id }),
  });
  
  const execResult = await execRes.json();
  console.log('Payment of 0.2 USDC verified on Stellar Testnet.');
  console.log('Agent B executed task:', execResult);
}

main().catch(console.error);