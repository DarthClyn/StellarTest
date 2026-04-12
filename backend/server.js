// Backend Hub Server - Reloading to apply store.json fixes
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

/**
 * --- CONFIGURATION ---
 */
const CONTRACT_ID = "CCPMOUQ3VKPLB4KVOOCE72BEVJVAOO7M62OILN3I4AV3PBGASJVU65HB";
const USDC_SAC    = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

const ROLES  = { CONTRACTOR: 'contractor', HUNTER: 'bounty_hunter' };
const HUB_PORT = 3001;

/**
 * --- SIMPLE STRUCTURED LOGGER ---
 */
const log = (type, msg, meta = {}) => {
    console.log(`[${type}] ${msg}`, Object.keys(meta).length ? meta : '');
};

/**
 * --- STATE ENGINE ---
 */
const STORE_FILE = path.join(__dirname, 'store.json');
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

if (fs.existsSync(STORE_FILE)) {
    try {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        store = JSON.parse(raw);
        log("BOOT", "Loaded persistent store from store.json");
    } catch (e) {
        log("BOOT_ERROR", "Failed to parse store.json. Starting fresh.");
    }
}

const saveStore = () => {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
        log("SAVE_ERROR", "Could not persist store to disk");
    }
};

/**
 * --- JSON HEADER ---
 */
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// ---------------------------------------------------------------------------
// 1. IDENTITY API
// ---------------------------------------------------------------------------
app.get('/api/agents/:addr', (req, res) => {
    const addr = req.params.addr;

    const identity = store.identities[addr] || {
        roles: [],
        totalStake: 0,
        registered: false
    };

    const involvedTasks = Object.values(store.tasks).filter(t =>
        t.contractorAddr === addr || t.bountyHunterAddr === addr
    );

    res.json({
        identity,
        history: involvedTasks,
        canPost: identity.roles.includes(ROLES.CONTRACTOR),
        canWork: identity.roles.includes(ROLES.HUNTER)
    });
});

app.get('/api/agents/:addr/stake', (req, res) => {
    const addr = req.params.addr;
    const identity = store.identities[addr];

    if (!identity) {
        return res.status(404).json({ error: "Agent not found" });
    }

    res.json({
        addr: addr,
        stake: identity.stake,
        stake_xlm: identity.stake_xlm
    });
});

// ---------------------------------------------------------------------------
// 2. X402 PAYMENT GATEWAY
// ---------------------------------------------------------------------------
app.get('/api/tasks/:taskId/download', (req, res) => {
    const { taskId } = req.params;
    const contractorAddr = req.query.addr;
    const task = store.tasks[taskId];

    if (!task) return res.status(404).json({ error: "Bounty not found" });

    if (task.contractorAddr !== contractorAddr) {
        return res.status(403).json({ error: "Unauthorized wallet" });
    }

    const txHash = req.headers['x-stellar-tx'];

    // CASE A: Issue invoice
    if (task.status !== 'paid' && !txHash) {
        log("X402_CHALLENGE", "Payment required", {
            taskId,
            amount: task.reward,
            recipient: task.bountyHunterAddr
        });

        return res.status(402).json({
            status: "Payment Required",
            invoice: {
                amount: task.reward,
                asset: "USDC",
                recipient: task.bountyHunterAddr,
                memo: `Bazar-Unlock-${taskId}`
            }
        });
    }

    // CASE B: Unlock
    if (task.status === 'paid') {
        if (txHash && task.onChainHash !== txHash) {
            return res.status(403).json({ error: "Hash mismatch" });
        }

        log("X402_SUCCESS", "Payload unlocked", {
            taskId,
            txHash: task.onChainHash
        });

        return res.json({
            success: true,
            payload: task.workNote || "CONFIDENTIAL_DELIVERY_DATA",
            receipt: {
                from: task.contractorAddr,
                to: task.bountyHunterAddr,
                hash: task.onChainHash
            }
        });
    }

    return res.status(402).json({
        error: "Payment initiated but not yet verified"
    });
});

// ---------------------------------------------------------------------------
// 3. SYNC ENGINE
// ---------------------------------------------------------------------------
app.post('/api/hub/sync', (req, res) => {
    const { event, data } = req.body;
    const now = new Date().toISOString();

    log("SYNC", "Incoming event", {
        event,
        taskId: data?.taskId,
        addr: data?.addr
    });

    store.eventLog.push({ event, data, timestamp: now });

    switch (event) {

        // ------------------ IDENTITY ------------------
        case 'reg':
            log("IDENTITY", "Register/update", data);

            if (!store.identities[data.addr]) {
                store.identities[data.addr] = {
                    addr: data.addr,
                    roles: [data.role],
                    stake: data.stake,
                    stake_xlm: data.stake / 10_000_000,
                    registered: true
                };
                store.stats.totalAgents++;
            } else {
                const agent = store.identities[data.addr];
                if (!agent.roles.includes(data.role)) {
                    agent.roles.push(data.role);
                }
                // Always sync/update the latest stake value sent by the MCP
                agent.stake = data.stake;
                agent.stake_xlm = data.stake / 10_000_000;
                agent.registered = true;
            }
            break;

        // ------------------ STAKE MANAGEMENT ------------------
        case 'stake_slashed': {
            const agent = store.identities[data.agentId];
            if (agent) {
                agent.stake -= data.amount;
                agent.stake_xlm -= data.amount / 10_000_000;
                log("STAKE_SLASHED", "Agent stake updated", { agentId: data.agentId, newStake: agent.stake, reason: data.reason });
            }
            break;
        }

        case 'stake_topped_up': {
            const agent = store.identities[data.agentId];
            if (agent) {
                agent.stake += data.amount;
                agent.stake_xlm += data.amount / 10_000_000;
                log("STAKE_TOPUP", "Agent stake updated", { agentId: data.agentId, newStake: agent.stake });
            }
            break;
        }

        case 'admin_updated': {
            log("ADMIN_UPDATE", "Admin address has been updated", { newAdmin: data.newAdmin });
            break;
        }


        // ------------------ CREATE TASK ------------------
        case 'task_new':
            if (store.tasks[data.taskId]) {
                log("TASK_DUPLICATE", "Rejected duplicate task", { taskId: data.taskId });
                return res.status(400).json({ error: "Task already exists" });
            }

            store.tasks[data.taskId] = {
                taskId: data.taskId,
                title: data.title,
                contractorAddr: data.contractor,
                reward: data.reward,
                status: 'open',
                bountyHunterAddr: null,
                applicants: [],
                workNote: null,
                onChainHash: null
            };

            store.stats.activeBounties++;
            log("TASK_NEW", "Created", store.tasks[data.taskId]);
            break;

        // ------------------ APPLY ------------------
        case 'task_apply': {
            const hunter = data.bounty_hunter;

            if (!hunter) {
                log("TASK_APPLY_ERR", "Missing bounty_hunter field", data);
                return res.status(400).json({ error: "Missing bounty_hunter field" });
            }

            const applyTask = store.tasks[data.taskId];
            if (!applyTask) return res.status(404).json({ error: "Task not found" });

            // ✅ Self-heal instead of throwing
            if (applyTask.applicants.includes(hunter)) {
                log("TASK_APPLY_DUP", "Already applied", { taskId: data.taskId, hunter });
                return res.json({ synced: true, message: "Already applied" });
            }

            applyTask.applicants.push(hunter);
            log("TASK_APPLY", "Hunter applied", { taskId: data.taskId, hunter });
            break;
        }

        // ------------------ ALLOT ------------------
        case 'task_allot': {
            const hunter = data.bounty_hunter;

            if (!hunter) {
                log("TASK_ALLOT_ERR", "Missing bounty_hunter field", data);
                return res.status(400).json({ error: "Missing bounty_hunter field" });
            }

            const allotTask = store.tasks[data.taskId];
            if (!allotTask) return res.status(404).json({ error: "Task not found" });

            // ✅ Chain is truth. If hub missed the apply sync, auto-heal.
            if (!allotTask.applicants.includes(hunter)) {
                log("TASK_ALLOT_WARNING", "Hunter missed apply event. Auto-healing.", { taskId: data.taskId, hunter });
                allotTask.applicants.push(hunter);
            }

            allotTask.status = 'allotted';
            allotTask.bountyHunterAddr = hunter;
            log("TASK_ALLOT", "Assigned", { taskId: data.taskId, hunter });
            break;
        }

        // ------------------ SUBMIT ------------------
        case 'task_sub': {
            const subTask = store.tasks[data.taskId];
            if (!subTask) return res.status(404).json({ error: "Task not found" });

            log("TASK_SUBMIT_CHECK", "Verifying assignment", {
                expected: subTask.bountyHunterAddr,
                received: data.addr
            });

            // ✅ Fix state if allot sync was missed but chain says it's ok
            if (subTask.status !== 'allotted') {
                log("TASK_SUBMIT_WARNING", "Task out of sync. Healing status to allotted.", { taskId: data.taskId, status: subTask.status });
            }
            if (subTask.bountyHunterAddr !== data.addr) {
                log("TASK_SUBMIT_WARNING", "Agent assignment mismatch. Auto-healing.", { taskId: data.taskId, expected: subTask.bountyHunterAddr, received: data.addr });
                subTask.bountyHunterAddr = data.addr;
            }

            subTask.status = 'submitted';
            subTask.workNote = data.workNote;
            log("TASK_SUBMIT", "Work submitted", { taskId: data.taskId, hunter: data.addr });
            break;
        }

        // ------------------ PAID ------------------
        case 'task_paid': {
            const paidTask = store.tasks[data.taskId];
            if (!paidTask) return res.status(404).json({ error: "Task not found" });

            // ✅ Chain ensures valid transition. Heal if out of sync locally.
            if (paidTask.status !== 'submitted') {
                log("TASK_PAID_WARNING", "Task not explicitly submitted. Healing state.", { taskId: data.taskId, status: paidTask.status });
            }

            paidTask.status = 'paid';
            paidTask.onChainHash = data.txHash;

            store.stats.totalUSDCFlow += paidTask.reward;
            store.stats.activeBounties--;

            log("TASK_PAID", "Payment settled", {
                taskId: data.taskId,
                txHash: data.txHash,
                amount: paidTask.reward
            });
            break;
        }

        default:
            log("UNKNOWN_EVENT", "Unhandled event", { event });
    }

    saveStore(); // Persist the updated state automatically
    res.json({ synced: true, hubTime: now });
});

// ---------------------------------------------------------------------------
// 4. DASHBOARD
// ---------------------------------------------------------------------------
app.get('/api/dashboard/tasks', (req, res) => {
    res.json(Object.values(store.tasks));
});

app.get('/api/dashboard/activity', (req, res) => {
    res.json(store.eventLog.slice(-15).reverse());
});

app.get('/api/dashboard/stats', (req, res) => {
    res.json(store.stats);
});

app.get('/api/dashboard/agents', (req, res) => {
    res.json(Object.values(store.identities));
});

// ---------------------------------------------------------------------------
// 5. HEALTH
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        port: HUB_PORT,
        agents: Object.keys(store.identities).length,
        tasks: Object.keys(store.tasks).length,
        time: new Date().toISOString()
    });
});

app.listen(HUB_PORT, () => {
    log("START", "Serve Backend Hub running", {
        port: HUB_PORT,
        roles: "contractor | bounty_hunter"
    });
});