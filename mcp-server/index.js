import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawnSync, execSync } from "child_process";

// CONFIG
const CONTRACT_ID = "CBXDD2KRKCPNU5PVWADDTFGFLSAUCA73CFOMGYNCBSNDMO4DZWMOXMS5";
const USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const SECRET_KEY = process.env.STELLAR_SECRET_KEY;
const ROLE = process.env.AGENT_ROLE; 
const HUB = process.env.HUB_URL || "http://localhost:3001";

const server = new Server(
  { name: "bazar-mcp", version: "3.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "get_wallet_info", description: "Get agent public address.", inputSchema: { type: "object", properties: {} } },
    { name: "register_on_bazar", description: "Stake XLM to join platform.", inputSchema: { type: "object", properties: { stake: { type: "number" } }, required: ["stake"] } },
    { name: "post_task_to_hub", description: "Poster: Create a new bounty.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, title: { type: "string" }, reward: { type: "number" } }, required: ["taskId", "title", "reward"] } },
    { name: "find_tasks", description: "Hunter: Search for open work.", inputSchema: { type: "object", properties: {} } },
    { name: "secure_download", description: "Poster: Pay USDC and download file.", inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_wallet_info") {
      const addr = execSync(`stellar keys address ${SECRET_KEY}`).toString().trim();
      return { content: [{ type: "text", text: `Public Address: ${addr}` }] };
    }

    if (name === "register_on_bazar") {
      const stroops = Math.floor(args.stake * 10000000).toString(); 
      
      // ARRAY SYNTAX: This is the only way to guarantee Windows doesn't break the double-dash
      const result = spawnSync("stellar", [
        "contract", "invoke",
        "--id", CONTRACT_ID,
        "--source", SECRET_KEY,
        "--network", "testnet",
        "--", 
        "register",
        "--id", ROLE,
        "--addr", SECRET_KEY,
        "--role", ROLE,
        "--stake", stroops
      ], { encoding: "utf-8" });

      if (result.error || result.status !== 0) {
        throw new Error(result.stderr || "Registration failed");
      }
      return { content: [{ type: "text", text: `Success! Registered as ${ROLE} on-chain.\n${result.stdout}` }] };
    }

    if (name === "post_task_to_hub") {
      await fetch(`${HUB}/api/tasks/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args)
      });
      return { content: [{ type: "text", text: `Task '${args.title}' posted. Reward: ${args.reward} USDC.` }] };
    }

    if (name === "find_tasks") {
      const res = await fetch(`${HUB}/api/tasks/open`);
      const tasks = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
    }

    if (name === "secure_download") {
      let res = await fetch(`${HUB}/api/tasks/${args.taskId}/download`);
      if (res.status === 402) {
        const invoice = await res.json();
        const amountStroops = Math.floor(invoice.amount * 10000000).toString();
        const myAddr = execSync(`stellar keys address ${SECRET_KEY}`).toString().trim();
        
        const result = spawnSync("stellar", [
          "contract", "invoke",
          "--id", USDC_SAC,
          "--source", SECRET_KEY,
          "--network", "testnet",
          "--",
          "transfer",
          "--from", myAddr,
          "--to", invoice.destination,
          "--amount", amountStroops
        ], { encoding: "utf-8" });

        const txHash = result.stdout.match(/ID: (\w+)/)?.[1] || "success";
        res = await fetch(`${HUB}/api/tasks/${args.taskId}/download`, { headers: { 'x-stellar-tx': txHash } });
        return { content: [{ type: "text", text: "USDC Payment confirmed. Unlocking file..." }] };
      }
      return { content: [{ type: "text", text: "Download initiated or file already owned." }] };
    }

  } catch (e) {
    return { content: [{ type: "text", text: `ERROR: ${e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);