const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

/**
 * --- CONFIGURATION ---
 */
const CONTRACT_ID = "CBCZOBH5X2H7MBMDSPJAPB2VR5KE566ZCGKKX37K44F4ED6TVIQHAPUW";
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
                    totalStake: data.stake,
                    registered: true
                };
                store.stats.totalAgents++;
            } else if (!store.identities[data.addr].roles.includes(data.role)) {
                store.identities[data.addr].roles.push(data.role);
                store.identities[data.addr].totalStake += data.stake;
            }
            break;

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
        case 'task_apply':
            if (store.tasks[data.taskId]) {
                const task = store.tasks[data.taskId];

                if (!task.applicants.includes(data.hunter)) {
                    task.applicants.push(data.hunter);
                }

                log("TASK_APPLY", "Hunter applied", {
                    taskId: data.taskId,
                    hunter: data.hunter
                });
            }
            break;

        // ------------------ ALLOT ------------------
        case 'task_allot':
            if (store.tasks[data.taskId]) {
                const task = store.tasks[data.taskId];

                if (task.status !== 'open') return;

                if (!task.applicants.includes(data.hunter)) {
                    log("TASK_ALLOT_WARN", "Hunter not in applicants", {
                        taskId: data.taskId,
                        hunter: data.hunter
                    });
                }

                task.status = 'allotted';
                task.bountyHunterAddr = data.hunter;

                log("TASK_ALLOT", "Assigned", {
                    taskId: data.taskId,
                    hunter: data.hunter
                });
            }
            break;

        // ------------------ SUBMIT ------------------
        case 'task_sub':
            if (store.tasks[data.taskId]) {
                const task = store.tasks[data.taskId];

                log("TASK_SUBMIT_CHECK", "Verifying assignment", {
                    expected: task.bountyHunterAddr,
                    received: data.addr
                });

                if (task.bountyHunterAddr !== data.addr) {
                    log("TASK_SUBMIT_REJECTED", "Unauthorized submission", {
                        taskId: data.taskId,
                        hunter: data.addr
                    });

                    return res.status(403).json({
                        error: "Not assigned to this task"
                    });
                }

                task.status = 'submitted';
                task.workNote = data.workNote;

                log("TASK_SUBMIT", "Work submitted", {
                    taskId: data.taskId,
                    hunter: data.addr
                });
            }
            break;

        // ------------------ PAID ------------------
        case 'task_paid':
            if (store.tasks[data.taskId]) {
                const task = store.tasks[data.taskId];

                task.status = 'paid';
                task.onChainHash = data.txHash;

                store.stats.totalUSDCFlow += task.reward;
                store.stats.activeBounties--;

                log("TASK_PAID", "Payment settled", {
                    taskId: data.taskId,
                    txHash: data.txHash,
                    amount: task.reward
                });
            }
            break;

        default:
            log("UNKNOWN_EVENT", "Unhandled event", { event });
    }

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