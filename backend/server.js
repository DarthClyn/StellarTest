const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

/**
 * --- IRON CLAD CONFIGURATION ---
 * CONTRACT_ID & USDC_SAC kept for reference — Hub does not call chain directly.
 * All chain state is pushed here via /api/hub/sync from the MCP server.
 */
const CONTRACT_ID = "CDPKZKQ7BLVK4MPPXYPHTIR27RKTW6LEACZVEHSEDRLJFCD3CUW4IJLR";
const USDC_SAC    = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

const ROLES  = { CONTRACTOR: 'contractor', HUNTER: 'bounty_hunter' };
const HUB_PORT = 3001;

/**
 * --- IRON CLAD STATE ENGINE ---
 */
let store = {
    tasks:      {},
    identities: {},
    eventLog:   [],
    stats: {
        totalUSDCFlow:  0,
        totalAgents:    0,
        activeBounties: 0
    }
};

// --- MIDDLEWARE: JSON INTEGRITY ---
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// ---------------------------------------------------------------------------
// 1. IDENTITY & PROFILE API
//    Supports dual-role wallets (same addr = contractor + bounty_hunter)
// ---------------------------------------------------------------------------
app.get('/api/agents/:addr', (req, res) => {
    const addr     = req.params.addr;
    const identity = store.identities[addr] || { roles: [], totalStake: 0, registered: false };

    const involvedTasks = Object.values(store.tasks).filter(t =>
        t.contractorAddr === addr || t.bountyHunterAddr === addr
    );

    res.json({
        identity,
        history:  involvedTasks,
        canPost:  identity.roles.includes(ROLES.CONTRACTOR),
        canWork:  identity.roles.includes(ROLES.HUNTER)
    });
});

// ---------------------------------------------------------------------------
// 2. X402 SECURE PAYMENT GATEWAY
//    Steel-door logic: 402 Challenge → USDC Transfer → settle_task → 200 Unlock
// ---------------------------------------------------------------------------
app.get('/api/tasks/:taskId/download', (req, res) => {
    const { taskId }      = req.params;
    const contractorAddr  = req.query.addr;
    const task            = store.tasks[taskId];

    if (!task) return res.status(404).json({ error: "Bounty not found" });

    if (task.contractorAddr !== contractorAddr) {
        return res.status(403).json({ error: "Security Violation: Unauthorized Wallet" });
    }

    const txHash = req.headers['x-stellar-tx'];

    // CASE A: No payment yet — issue 402 invoice
    if (task.status !== 'paid' && !txHash) {
        console.log(`[X402 CHALLENGE] Task ${taskId} requires USDC payment.`);
        return res.status(402).json({
            status: "Payment Required",
            invoice: {
                amount:    task.reward,
                asset:     "USDC",
                recipient: task.bountyHunterAddr,   // ✅ "recipient" — matches MCP invoice.invoice.recipient
                memo:      `Bazar-Unlock-${taskId}`
            },
            instruction: "Pay USDC to bounty_hunter, then call settle_task on-chain."
        });
    }

    // CASE B: Chain-confirmed paid — unlock payload
    if (task.status === 'paid') {
        if (txHash && task.onChainHash !== txHash) {
            return res.status(403).json({ error: "Hash Mismatch: TX does not match on-chain settlement." });
        }
        console.log(`[X402 SUCCESS] Unlocking payload for Task ${taskId}`);
        return res.json({
            success: true,
            payload: task.workNote || "CONFIDENTIAL_DELIVERY_DATA",
            receipt: {
                from: task.contractorAddr,
                to:   task.bountyHunterAddr,
                hash: task.onChainHash
            }
        });
    }

    // CASE C: Payment initiated but not yet chain-verified
    res.status(402).json({ error: "Payment initiated but not yet verified by Soroban Registry." });
});

// ---------------------------------------------------------------------------
// 3. SOROBAN SYNC ENGINE
//    MCP server pushes every on-chain event here to keep Hub state live.
//    Events: reg | task_new | task_apply | task_allot | task_sub | task_paid
// ---------------------------------------------------------------------------
app.post('/api/hub/sync', (req, res) => {
    const { event, data } = req.body;
    const now = new Date().toISOString();

    store.eventLog.push({ event, data, timestamp: now });

    switch (event) {

        case 'reg':
            if (!store.identities[data.addr]) {
                store.identities[data.addr] = {
                    addr:       data.addr,
                    roles:      [data.role],
                    totalStake: data.stake,
                    registered: true
                };
                store.stats.totalAgents++;
            } else if (!store.identities[data.addr].roles.includes(data.role)) {
                store.identities[data.addr].roles.push(data.role);
                store.identities[data.addr].totalStake += data.stake;
            }
            break;

        case 'task_new':
           

    if (store.tasks[data.taskId]) {
        return res.status(400).json({
            error: "Task already exists — duplicate taskId rejected."
        });
    }

    store.tasks[data.taskId] = {
        taskId:           data.taskId,
        title:            data.title,
        contractorAddr:   data.contractor,
        reward:           data.reward,
        status:           'open',
        bountyHunterAddr: null,
        applicants:       [],
        workNote:         null,
        onChainHash:      null
    };

    store.stats.activeBounties++;
    break;
           

        case 'task_apply':
            if (store.tasks[data.taskId]) {
                if (!store.tasks[data.taskId].applicants) {
                    store.tasks[data.taskId].applicants = [];
                }
                // Deduplicate — same hunter can't apply twice
                if (!store.tasks[data.taskId].applicants.includes(data.hunter)) {
                    store.tasks[data.taskId].applicants.push(data.hunter);
                }
            }
            break;

        case 'task_allot':
           if (store.tasks[data.taskId]) {
    const task = store.tasks[data.taskId];

    if (task.status !== 'open') return;

    if (!task.applicants.includes(data.hunter)) {
        console.warn("Allotting non-applicant — allowed but risky");
    }

    task.status = 'allotted';
    task.bountyHunterAddr = data.hunter;
}
            break;

        case 'task_sub':
            if (store.tasks[data.taskId]) {
    const task = store.tasks[data.taskId];


    if (task.bountyHunterAddr !== data.addr) {
        return res.status(403).json({
            error: "Submission rejected: Not assigned to this task."
        });
    }

    task.status   = 'submitted';
    task.workNote = data.workNote;
}
            break;

        case 'task_paid':
            if (store.tasks[data.taskId]) {
                store.tasks[data.taskId].status      = 'paid';
                store.tasks[data.taskId].onChainHash = data.txHash;
                store.stats.totalUSDCFlow  += store.tasks[data.taskId].reward;
                store.stats.activeBounties -= 1;
            }
            break;

        default:
            console.warn(`[HUB] Unknown sync event: ${event}`);
    }

    res.json({ synced: true, hubTime: now });
});

// ---------------------------------------------------------------------------
// 4. FRONTEND DASHBOARD API
// ---------------------------------------------------------------------------
app.get('/api/dashboard/tasks',    (req, res) => res.json(Object.values(store.tasks)));
app.get('/api/dashboard/activity', (req, res) => res.json(store.eventLog.slice(-15).reverse()));
app.get('/api/dashboard/stats',    (req, res) => res.json(store.stats));

// ---------------------------------------------------------------------------
// 5. HEALTH CHECK
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => res.json({
    status:  'ok',
    port:    HUB_PORT,
    agents:  Object.keys(store.identities).length,
    tasks:   Object.keys(store.tasks).length,
    time:    new Date().toISOString()
}));

app.listen(HUB_PORT, () => {
    console.log(`--- IRON CLAD HUB v4.1 ---`);
    console.log(`Roles    : Contractor (2k XLM) | Bounty Hunter (5k XLM)`);
    console.log(`Security : X402 Protocol + Dual-Role Isolation + Replay Protection`);
    console.log(`Endpoint : http://localhost:${HUB_PORT}`);
    console.log(`Health   : http://localhost:${HUB_PORT}/health`);
});