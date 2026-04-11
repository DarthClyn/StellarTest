import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawnSync, execSync } from "child_process";

/**
 * --- IRON CLAD CONFIGURATION ---
 */
const CONTRACT_ID = "CDPKZKQ7BLVK4MPPXYPHTIR27RKTW6LEACZVEHSEDRLJFCD3CUW4IJLR";
const USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const SECRET_KEY = process.env.STELLAR_SECRET_KEY;
const ROLE = process.env.AGENT_ROLE; // 'contractor' or 'bounty_hunter'
const HUB = "http://localhost:3001";

const server = new Server(
  { name: "bazar-mcp-pro", version: "4.5.0" },
  { capabilities: { tools: {} } }
);

/**
 * --- THE COMPLETE TOOLSET ---
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "verify_address",    description: "Derive and verify your Stellar address from secret key.", inputSchema: { type: "object", properties: {} } },
    { name: "get_wallet_status", description: "Get address and Hub registration status.", inputSchema: { type: "object", properties: {} } },
    { name: "register_identity", description: "Stake XLM to join (Contractor: 2k, Hunter: 5k).", inputSchema: { type: "object", properties: { stake: { type: "number" } }, required: ["stake"] } },
    { name: "post_bounty",       description: "Contractor: Create a new task on-chain.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, title: { type: "string" }, reward: { type: "number" } }, required: ["taskId", "title", "reward"] } },
    { name: "scout_tasks",       description: "Hunter: Find open bounties on the Hub.", inputSchema: { type: "object", properties: {} } },
    { name: "apply_for_task",    description: "Hunter: Request a task on-chain.", inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
    { name: "assign_worker",     description: "Contractor: Allot a task to a specific hunter.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, hunterAddr: { type: "string" } }, required: ["taskId", "hunterAddr"] } },
    { name: "deliver_work",      description: "Hunter: Submit work payload to Hub and Chain.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, workNote: { type: "string" } }, required: ["taskId", "workNote"] } },
    { name: "pay_and_unlock",    description: "Contractor: The X402 Master Tool. Pays USDC, Settles Chain, Unlocks Data.", inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
    { name: "initiate_exit",     description: "Agent: Start 24h cooldown to withdraw stake.", inputSchema: { type: "object", properties: {} } }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const auth = ["--source", SECRET_KEY, "--network", "testnet"];

  // ✅ FIX 1: myAddr inside try/catch — won't crash server
  let myAddr;
  try {
    myAddr = execSync(`stellar keys address ${SECRET_KEY}`, { encoding: 'utf-8' }).trim();
  } catch (e) {
    return { content: [{ type: "text", text: `FATAL: Cannot derive address. Check STELLAR_SECRET_KEY. ${e.message}` }], isError: true };
  }


  const syncHub = async (event, data) => {
    await fetch(`${HUB}/api/hub/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data: { ...data, addr: myAddr } })
    });
  };

  // ✅ Sanitize taskId to Stellar Symbol format: uppercase, numbers, underscores only
  const toSymbol = (id) => id.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

  try {

    // ✅ NEW: VERIFY ADDRESS
    if (name === "verify_address") {
      return { content: [{ type: "text", text: `Your Stellar Address: ${myAddr}\nRole: ${ROLE}\nNetwork: testnet` }] };
    }

    // ✅ FIX: GET WALLET STATUS
    if (name === "get_wallet_status") {
      const res = await fetch(`${HUB}/api/agents/${myAddr}`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    // 1. IDENTITY MANAGEMENT
    if (name === "register_identity") {
      const stroops = (args.stake * 10000000).toString();
      const agentId = toSymbol(`${ROLE}_${myAddr.slice(-6)}`);
      console.error(`[STAKE]: Registering ${ROLE} with ${args.stake} XLM...`);
      spawnSync("stellar", ["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--", "register", "--agent_id", agentId, "--addr", myAddr, "--role", ROLE, "--stake", stroops], { encoding: "utf-8" });
      await syncHub('reg', { role: ROLE, stake: args.stake });
      return { content: [{ type: "text", text: `Success: Registered as ${ROLE}. Identity Synced.` }] };
    }

    // 2. CONTRACTOR: BOUNTY CREATION
    if (name === "post_bounty") {
      const taskId = toSymbol(args.taskId);  // ✅ sanitize
      const rewardStroops = (args.reward * 10000000).toString();
      spawnSync("stellar", ["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--", "create_task", "--task_id", taskId, "--contractor", myAddr, "--reward", rewardStroops], { encoding: "utf-8" });
      await syncHub('task_new', { taskId, reward: args.reward, contractor: myAddr, title: args.title });
      return { content: [{ type: "text", text: `Bounty '${args.title}' (${taskId}) is live on-chain.` }] };
    }

    // ✅ FIX: SCOUT TASKS — Hub-based, not XDR chain events
    if (name === "scout_tasks") {
      const res = await fetch(`${HUB}/api/dashboard/tasks`);
      const tasks = await res.json();
      const open = tasks.filter(t => t.status === 'open');
      const display = open.length
        ? open.map(t => `• [${t.taskId}] ${t.title} — ${t.reward} USDC | Applicants: ${(t.applicants || []).length}`).join('\n')
        : "No open bounties found.";
      return { content: [{ type: "text", text: display }] };
    }

    // 3. HUNTER: APPLICATION
    // ⚠️ Note: request_task does NOT exist in contract — Hub-only until redeployed
    if (name === "apply_for_task") {
      const taskId = toSymbol(args.taskId);  // ✅ sanitize
      await syncHub('task_apply', { taskId, hunter: myAddr });
      return { content: [{ type: "text", text: `Applied for ${taskId}. Awaiting Contractor allotment.` }] };
    }

    // 4. CONTRACTOR: ALLOTMENT
    if (name === "assign_worker") {
      const taskId = toSymbol(args.taskId);  // ✅ sanitize
      spawnSync("stellar", ["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--", "allot_task", "--task_id", taskId, "--contractor", myAddr, "--hunter", args.hunterAddr], { encoding: "utf-8" });
      await syncHub('task_allot', { taskId, hunter: args.hunterAddr });
      return { content: [{ type: "text", text: `Task ${taskId} officially allotted to ${args.hunterAddr}.` }] };
    }

    // 5. HUNTER: DELIVERY
    if (name === "deliver_work") {
      const taskId = toSymbol(args.taskId);  // ✅ sanitize
      spawnSync("stellar", ["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--", "submit_task", "--task_id", taskId, "--hunter", myAddr], { encoding: "utf-8" });
      await syncHub('task_sub', { taskId, workNote: args.workNote });
      return { content: [{ type: "text", text: "Work submitted. Payment challenge ready for Contractor." }] };
    }

    // ✅ FIX: initiate_exit handler — was completely missing
    if (name === "initiate_exit") {
      const agentId = toSymbol(`${ROLE}_${myAddr.slice(-6)}`);  // ✅ sanitize
      spawnSync("stellar", ["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--", "request_exit", "--agent_id", agentId], { encoding: "utf-8" });
      return { content: [{ type: "text", text: `Exit initiated. 24h cooldown started. Stake will be refunded after cooldown.` }] };
    }

    // 6. ✅ FIX: X402 — invoice.destination → invoice.recipient
    if (name === "pay_and_unlock") {
      const taskId = toSymbol(args.taskId);  // ✅ sanitize
      const res = await fetch(`${HUB}/api/tasks/${taskId}/download?addr=${myAddr}`);
      if (res.status !== 402) return { content: [{ type: "text", text: "Task not in payment-ready state." }] };

      const invoice = await res.json();
      const stroops = (invoice.invoice.amount * 10000000).toString();
      const recipient = invoice.invoice.recipient;

      console.error(`[X402]: Paying ${invoice.invoice.amount} USDC to Hunter ${recipient}...`);
      const payRes = spawnSync("stellar", ["contract", "invoke", "--id", USDC_SAC, ...auth, "--", "transfer", "--from", myAddr, "--to", recipient, "--amount", stroops], { encoding: "utf-8" });
      const txHash = payRes.stdout.match(/["']([a-f0-9]{64})["']/i)?.[1];
      if (!txHash) throw new Error("USDC Transfer failed — no tx hash found.");

      console.error(`[SETTLE]: Consuming hash ${txHash} on-chain...`);
      spawnSync("stellar", ["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--", "settle_task", "--task_id", taskId, "--contractor", myAddr, "--tx_hash", txHash], { encoding: "utf-8" });

      await syncHub('task_paid', { taskId, txHash });
      const finalRes = await fetch(`${HUB}/api/tasks/${taskId}/download?addr=${myAddr}`, { headers: { 'x-stellar-tx': txHash } });
      const data = await finalRes.json();

      return { content: [{ type: "text", text: `SUCCESS! Reward Paid. Unlocked Work: ${data.payload}` }] };
    }

  } catch (e) {
    console.error(e);
    return { content: [{ type: "text", text: `STALLAR_SYSTEM_ERROR: ${e.stderr || e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);