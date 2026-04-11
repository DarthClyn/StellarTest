import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawnSync } from "child_process";
import { Keypair } from "@stellar/stellar-sdk";

/**
 * --- IRON CLAD CONFIGURATION ---
 */
const CONTRACT_ID = "CBIBCZNBDMHAITGJCTSUTDX4COEPDJA53WAWCOFEXTKBE7YWHNV7ZAUC";
const USDC_SAC    = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const SECRET_KEY  = process.env.STELLAR_SECRET_KEY;
const ROLE        = process.env.AGENT_ROLE; // 'contractor' or 'bounty_hunter'
const HUB         = "http://localhost:3001";

// ── Exact stake amounts in XLM (enforced by contract) ────────────────────────
const STAKE_REQUIRED = { contractor: 200, bounty_hunter: 500 };

if (!SECRET_KEY) {
  console.error("FATAL: STELLAR_SECRET_KEY env var is not set.");
  process.exit(1);
}

const VALID_ROLES = ["contractor", "bounty_hunter"];
if (!VALID_ROLES.includes(ROLE)) {
  console.error(`FATAL: AGENT_ROLE must be 'contractor' or 'bounty_hunter'. Got: ${ROLE}`);
  process.exit(1);
}

let MY_ADDR;
try {
  MY_ADDR = Keypair.fromSecret(SECRET_KEY).publicKey();
} catch (e) {
  console.error("FATAL: Cannot derive address — invalid STELLAR_SECRET_KEY.", e.message);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sanitize to Stellar Symbol format: uppercase, numbers, underscores only */
const toSymbol = (id) => id.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

/** XLM → stroops */
const toStroops = (xlm) => Math.round(xlm * 10_000_000).toString();

/** Hub sync — fire and forget with structured error logging */
const syncHub = async (event, data) => {
  try {
    await fetch(`${HUB}/api/hub/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data: { ...data, addr: MY_ADDR } }),
    });
  } catch (e) {
    console.error(`[HUB SYNC WARN]: Failed to sync event '${event}':`, e.message);
  }
};

/** Run a Stellar CLI command and return { ok, stdout, stderr, status } */
const runStellar = (args) => {
  const result = spawnSync("stellar", args, { encoding: "utf-8" });
  const ok = result.status === 0 && !result.error;
  if (!ok) {
    console.error("[STELLAR CLI ERROR]", {
      status: result.status,
      stderr: result.stderr,
      error: result.error?.message,
    });
  }
  return {
    ok,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status,
  };
};

/** Hub fetch with timeout and JSON guard */
const hubFetch = async (path, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${HUB}${path}`, { ...options, signal: controller.signal });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`Hub returned non-JSON: ${text.slice(0, 200)}`); }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
};

const auth = ["--source", SECRET_KEY, "--network", "testnet"];

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "bazar-mcp-pro", version: "4.7.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Identity ──────────────────────────────────────────────────────────────
    { name: "verify_address",    description: "Derive and verify your Stellar address from secret key.",                                  inputSchema: { type: "object", properties: {} } },
    { name: "get_wallet_status", description: "Get address and Hub registration status.",                                                  inputSchema: { type: "object", properties: {} } },
    { name: "register_identity", description: "Stake real XLM to join. Contractor: exactly 200 XLM. Hunter: exactly 500 XLM.",            inputSchema: { type: "object", properties: { stake: { type: "number", description: "Exact XLM to stake: 200 for contractor, 500 for bounty_hunter" } }, required: ["stake"] } },
    { name: "initiate_exit",     description: "Agent: Start 24h cooldown to withdraw remaining stake.",                                    inputSchema: { type: "object", properties: {} } },
    { name: "admin_refund",      description: "Admin: Refund remaining stake to agent after 24h cooldown.",                               inputSchema: { type: "object", properties: { agentId: { type: "string" } }, required: ["agentId"] } },
    { name: "init_contract",     description: "Admin: Initialize contract with admin address. Run once after deploy.",                     inputSchema: { type: "object", properties: { adminAddr: { type: "string" } }, required: ["adminAddr"] } },

    // ── Stake Management ──────────────────────────────────────────────────────
    { name: "slash_stake",       description: "Admin: Slash (subtract) XLM from an agent's stake. Slashed XLM goes to admin wallet.",    inputSchema: { type: "object", properties: { agentId: { type: "string" }, amount: { type: "number", description: "XLM to slash" }, reason: { type: "string" } }, required: ["agentId", "amount", "reason"] } },
    { name: "top_up_stake",      description: "Agent: Add XLM to your stake to restore after slashing.",                                  inputSchema: { type: "object", properties: { agentId: { type: "string" }, amount: { type: "number", description: "XLM to add" } }, required: ["agentId", "amount"] } },
    { name: "get_stake",         description: "View an agent's current on-chain stake balance in XLM.",                                   inputSchema: { type: "object", properties: { agentId: { type: "string" } }, required: ["agentId"] } },
    { name: "update_admin",      description: "Admin: Rotate admin address to a new wallet.",                                              inputSchema: { type: "object", properties: { newAdmin: { type: "string" } }, required: ["newAdmin"] } },

    // ── Task Lifecycle ────────────────────────────────────────────────────────
    { name: "post_bounty",       description: "Contractor: Create a new task on-chain.",                                                   inputSchema: { type: "object", properties: { taskId: { type: "string" }, title: { type: "string" }, reward: { type: "number" } }, required: ["taskId", "title", "reward"] } },
    { name: "scout_tasks",       description: "Hunter: Find open bounties on the Hub.",                                                    inputSchema: { type: "object", properties: {} } },
    { name: "apply_for_task",    description: "Hunter: Request a task on-chain.",                                                          inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
    { name: "assign_worker",     description: "Contractor: Allot a task to a specific hunter.",                                            inputSchema: { type: "object", properties: { taskId: { type: "string" }, hunterAddr: { type: "string" } }, required: ["taskId", "hunterAddr"] } },
    { name: "deliver_work",      description: "Hunter: Submit work payload to Hub and Chain.",                                             inputSchema: { type: "object", properties: { taskId: { type: "string" }, workNote: { type: "string" } }, required: ["taskId", "workNote"] } },
    { name: "pay_and_unlock",    description: "Contractor: The X402 Master Tool. Pays USDC, Settles Chain, Unlocks Data.",                 inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {

    // ── verify_address ────────────────────────────────────────────────────────
    if (name === "verify_address") {
      return { content: [{ type: "text", text: `Your Stellar Address: ${MY_ADDR}\nRole: ${ROLE}\nNetwork: testnet` }] };
    }

    // ── get_wallet_status ─────────────────────────────────────────────────────
    if (name === "get_wallet_status") {
      const { json } = await hubFetch(`/api/agents/${MY_ADDR}`);
      return { content: [{ type: "text", text: JSON.stringify(json, null, 2) }] };
    }

    // ── init_contract ─────────────────────────────────────────────────────────
    if (name === "init_contract") {
      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "init", "--admin", args.adminAddr]);
      if (!res.ok) throw new Error(`init failed: ${res.stderr}`);
      return { content: [{ type: "text", text: `Contract initialized. Admin set to ${args.adminAddr}.` }] };
    }

    // ── register_identity ─────────────────────────────────────────────────────
    if (name === "register_identity") {
      // Enforce exact stake amounts matching contract constants
      const required = STAKE_REQUIRED[ROLE];
      if (args.stake !== required) {
        throw new Error(`Stake must be exactly ${required} XLM for ${ROLE}. Got: ${args.stake}`);
      }

      const stroops = toStroops(args.stake);
      const agentId = toSymbol(`${ROLE}_${MY_ADDR.slice(-6)}`);
      console.error(`[STAKE]: Registering ${ROLE} with ${args.stake} XLM (agentId: ${agentId})...`);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "register", "--agent_id", agentId, "--addr", MY_ADDR, "--role", ROLE, "--stake", stroops]);
      if (!res.ok) throw new Error(`register failed: ${res.stderr}`);

      await syncHub("reg", { role: ROLE, stake: args.stake });
      return { content: [{ type: "text", text: `Success: Registered as ${ROLE} with ${args.stake} XLM staked. Identity Synced.` }] };
    }

    // ── initiate_exit ─────────────────────────────────────────────────────────
    if (name === "initiate_exit") {
      const agentId = toSymbol(`${ROLE}_${MY_ADDR.slice(-6)}`);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "request_exit", "--agent_id", agentId]);
      if (!res.ok) throw new Error(`request_exit failed: ${res.stderr}`);

      return { content: [{ type: "text", text: "Exit initiated. 24h cooldown started. Call admin_refund after cooldown to receive remaining stake." }] };
    }

    // ── admin_refund ──────────────────────────────────────────────────────────
    if (name === "admin_refund") {
      const agentId = toSymbol(args.agentId);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "admin_refund", "--admin", MY_ADDR, "--agent_id", agentId]);
      if (!res.ok) throw new Error(`admin_refund failed: ${res.stderr}`);

      await syncHub("agent_refunded", { agentId });
      return { content: [{ type: "text", text: `Stake refunded to agent ${agentId}. Agent record removed.` }] };
    }

    // ── slash_stake ───────────────────────────────────────────────────────────
    if (name === "slash_stake") {
      if (!args.amount || args.amount <= 0) throw new Error("Slash amount must be positive.");
      const agentId = toSymbol(args.agentId);
      const stroops = toStroops(args.amount);
      const reason  = toSymbol(args.reason);

      console.error(`[SLASH]: Slashing ${args.amount} XLM from ${agentId} — reason: ${reason}`);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "slash_stake", "--agent_id", agentId, "--amount", stroops, "--reason", reason]);
      if (!res.ok) throw new Error(`slash_stake failed: ${res.stderr}`);

      await syncHub("stake_slashed", { agentId, amount: args.amount, reason: args.reason });
      return { content: [{ type: "text", text: `Slashed ${args.amount} XLM from ${agentId}. Reason: ${args.reason}` }] };
    }

    // ── top_up_stake ──────────────────────────────────────────────────────────
    if (name === "top_up_stake") {
      if (!args.amount || args.amount <= 0) throw new Error("Top-up amount must be positive.");
      const agentId = toSymbol(args.agentId);
      const stroops = toStroops(args.amount);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "top_up_stake", "--agent_id", agentId, "--amount", stroops]);
      if (!res.ok) throw new Error(`top_up_stake failed: ${res.stderr}`);

      await syncHub("stake_topped_up", { agentId, amount: args.amount });
      return { content: [{ type: "text", text: `Added ${args.amount} XLM to ${agentId}'s stake.` }] };
    }

    // ── get_stake ─────────────────────────────────────────────────────────────
    if (name === "get_stake") {
      const agentId = toSymbol(args.agentId);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "get_stake", "--agent_id", agentId]);
      if (!res.ok) throw new Error(`get_stake failed: ${res.stderr}`);

      // Parse stroops from output and convert to XLM
      const stroops = parseInt(res.stdout.trim().replace(/[^0-9]/g, ""), 10);
      const xlm     = (stroops / 10_000_000).toFixed(7);
      return { content: [{ type: "text", text: `Agent ${agentId} current stake: ${xlm} XLM (${stroops} stroops)` }] };
    }

    // ── update_admin ──────────────────────────────────────────────────────────
    if (name === "update_admin") {
      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "update_admin", "--new_admin", args.newAdmin]);
      if (!res.ok) throw new Error(`update_admin failed: ${res.stderr}`);

      await syncHub("admin_updated", { newAdmin: args.newAdmin });
      return { content: [{ type: "text", text: `Admin updated to ${args.newAdmin}.` }] };
    }

    // ── post_bounty ───────────────────────────────────────────────────────────
    if (name === "post_bounty") {
      if (!args.reward || args.reward <= 0) throw new Error("reward must be a positive number.");
      const taskId        = toSymbol(args.taskId);
      const rewardStroops = toStroops(args.reward);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "create_task", "--task_id", taskId, "--contractor", MY_ADDR, "--reward", rewardStroops]);
      if (!res.ok) throw new Error(`create_task failed: ${res.stderr}`);

      await syncHub("task_new", { taskId, reward: args.reward, contractor: MY_ADDR, title: args.title });
      return { content: [{ type: "text", text: `Bounty '${args.title}' (${taskId}) is live on-chain.` }] };
    }

    // ── scout_tasks ───────────────────────────────────────────────────────────
    if (name === "scout_tasks") {
      const { json: tasks } = await hubFetch("/api/dashboard/tasks");
      const open    = tasks.filter((t) => t.status === "open");
      const display = open.length
        ? open.map((t) => `• [${t.taskId}] ${t.title} — ${t.reward} USDC | Applicants: ${(t.applicants || []).length}`).join("\n")
        : "No open bounties found.";
      return { content: [{ type: "text", text: display }] };
    }

    // ── apply_for_task ────────────────────────────────────────────────────────
    if (name === "apply_for_task") {
      const taskId = toSymbol(args.taskId);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "request_task", "--task_id", taskId, "--bounty_hunter", MY_ADDR]);
      if (!res.ok) throw new Error(`request_task failed: ${res.stderr}`);

      await syncHub("task_apply", { taskId, bounty_hunter: MY_ADDR });
      return { content: [{ type: "text", text: `Applied for ${taskId} on-chain. Awaiting Contractor allotment.` }] };
    }

    // ── assign_worker ─────────────────────────────────────────────────────────
    if (name === "assign_worker") {
      const taskId = toSymbol(args.taskId);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "allot_task", "--task_id", taskId, "--contractor", MY_ADDR, "--bounty_hunter", args.hunterAddr]);
      if (!res.ok) throw new Error(`allot_task failed: ${res.stderr}`);

      await syncHub("task_allot", { taskId, bounty_hunter: args.hunterAddr });
      return { content: [{ type: "text", text: `Task ${taskId} officially allotted to ${args.hunterAddr}.` }] };
    }

    // ── deliver_work ──────────────────────────────────────────────────────────
    if (name === "deliver_work") {
      const taskId = toSymbol(args.taskId);

      const res = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "submit_task", "--task_id", taskId, "--bounty_hunter", MY_ADDR]);
      if (!res.ok) throw new Error(`submit_task failed: ${res.stderr}`);

      await syncHub("task_sub", { taskId, workNote: args.workNote });
      return { content: [{ type: "text", text: "Work submitted on-chain. Payment challenge ready for Contractor." }] };
    }

    // ── pay_and_unlock (X402) ─────────────────────────────────────────────────
    if (name === "pay_and_unlock") {
      const taskId = toSymbol(args.taskId);

      const { status, json: invoice } = await hubFetch(`/api/tasks/${taskId}/download?addr=${MY_ADDR}`);
      if (status !== 402) return { content: [{ type: "text", text: "Task not in payment-ready state." }] };

      const amount    = invoice?.invoice?.amount;
      const recipient = invoice?.invoice?.recipient;
      if (!amount || !recipient) throw new Error(`Malformed 402 invoice: ${JSON.stringify(invoice)}`);

      const stroops = toStroops(amount);
      console.error(`[X402]: Paying ${amount} USDC to Hunter ${recipient}...`);

      const payRes = runStellar(["contract", "invoke", "--id", USDC_SAC, ...auth, "--",
        "transfer", "--from", MY_ADDR, "--to", recipient, "--amount", stroops]);
      if (!payRes.ok) throw new Error(`USDC transfer failed: ${payRes.stderr}`);

      const combined = payRes.stdout + payRes.stderr;
      const txHash   = combined.match(/([a-f0-9]{64})/i)?.[1];
      if (!txHash) throw new Error(`No tx hash found in CLI output.\nstdout: ${payRes.stdout}\nstderr: ${payRes.stderr}`);

      console.error(`[SETTLE]: Consuming hash ${txHash} on-chain...`);

      const settleRes = runStellar(["contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "settle_task", "--task_id", taskId, "--contractor", MY_ADDR, "--tx_hash", txHash]);
      if (!settleRes.ok) throw new Error(`settle_task failed: ${settleRes.stderr}`);

      await syncHub("task_paid", { taskId, txHash });

      const { json: data } = await hubFetch(`/api/tasks/${taskId}/download?addr=${MY_ADDR}`, {
        headers: { "x-stellar-tx": txHash },
      });

      return { content: [{ type: "text", text: `SUCCESS! Reward Paid. Unlocked Work: ${data.payload}` }] };
    }

    // ── Unknown tool ──────────────────────────────────────────────────────────
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };

  } catch (e) {
    console.error("[HANDLER ERROR]", e);
    return { content: [{ type: "text", text: `STELLAR_SYSTEM_ERROR: ${e.message}` }], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);