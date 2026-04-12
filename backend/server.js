// Backend Hub Server - Reloading to apply store.json fixes
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { spawnSync } = require('child_process');
const app = express();

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const taskId = req.params.taskId;
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, `${taskId}-${Date.now()}-${safeName}`);
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

/**
 * --- CONFIGURATION ---
 */
const CONTRACT_ID = "CCPMOUQ3VKPLB4KVOOCE72BEVJVAOO7M62OILN3I4AV3PBGASJVU65HB";
const USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

const ROLES = { CONTRACTOR: 'contractor', HUNTER: 'bounty_hunter' };
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
/**
 * --- STATE ENGINE & PERSISTENCE ---
 */
const STORE_FILE = path.join(__dirname, 'store.json');
let store = {
    tasks: {},
    identities: {},
    eventLog: [],
    stats: {
        totalUSDCFlow: 0,
        totalAgents: 0,
        activeBounties: 0
    }
};

const saveStore = () => {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
        log("SAVE_ERROR", "Could not persist store to disk", e);
    }
};

// Initial Load
if (fs.existsSync(STORE_FILE)) {
    try {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        store = { ...store, ...parsed };
        log("BOOT", "Loaded persistent store from store.json");
    } catch (e) {
        log("BOOT_ERROR", "Failed to parse store.json. Starting fresh.", e);
    }
}

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
        t.contractorAddr === addr || t.bountyHunterAddr === addr || (t.applicants && t.applicants.includes(addr))
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
// 2. X402 PAYMENT GATEWAY & ARTIFACTS
// ---------------------------------------------------------------------------

/**
 * Resolve MIME type from filename extension if declared type is generic.
 */
function getMimeType(filename, declaredMime) {
    if (declaredMime && declaredMime !== 'application/octet-stream') return declaredMime;
    const ext = (path.extname(filename) || '').toLowerCase();
    const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain' };
    return map[ext] || 'application/octet-stream';
}

/**
 * HUNTER: Upload artifacts for a task
 *
 * judgeWork — vision-capable LLM judge.
 * @param {string} requirement  - The task title / contractor's requirement.
 * @param {Array}  files        - Array of stored file metadata objects (must have .filename, .originalName, .mimetype).
 * @returns {number|null} Score 0-100, or null on API error.
 */
async function judgeWork(requirement, files) {
    log("HUB_JUDGE", `Analyzing submission for: "${requirement}" (${files.length} file(s))`);

    try {
        const fetchApi = typeof fetch !== "undefined" ? fetch : (...args) => import('node-fetch').then(({default: f}) => f(...args));

        // Build multimodal content — text requirement + embedded images
        const userContent = [
            { type: "text", text: `USER_REQUIREMENT: ${requirement}` }
        ];

        for (const f of files) {
            const mime = getMimeType(f.originalName, f.mimetype);
            const filePath = path.join(uploadDir, f.filename);

            if (mime.startsWith('image/') && fs.existsSync(filePath)) {
                const b64 = fs.readFileSync(filePath).toString('base64');
                userContent.push({
                    type: "image_url",
                    image_url: { url: `data:${mime};base64,${b64}` }
                });
                userContent.push({ type: "text", text: `[Image file: ${f.originalName}]` });
                log("JUDGE_IMAGE", `Embedded image for judging: ${f.originalName} (${(f.size/1024).toFixed(1)} KB)`);
            } else {
                userContent.push({ type: "text", text: `[Non-image file: ${f.originalName} — ${mime}]` });
            }
        }

        const response = await fetchApi("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3001",
                "X-Title": "AgentBazaar Hub"
            },
            body: JSON.stringify({
                model: "google/gemini-3.1-flash-lite-preview", // Vision-capable free model
                messages: [
                    {
                        role: "system",
                        content: `You are a neutral judge for a decentralized marketplace.
Compare the USER_REQUIREMENT with the HUNTER_SUBMISSION.
Rate the work on a scale of 0 to 100.
- 0-49: Spam, placeholder text, or completely unrelated.
- 50-79: Attempted but low quality or incomplete.
- 80-100: High quality and satisfies requirements.
If images are provided, visually evaluate them against the requirement.
Output ONLY the integer score. No explanation.`
                    },
                    { role: "user", content: userContent }
                ]
            })
        });

        const data = await response.json();
        if (data.error) {
            log("JUDGE_API_ERROR", "OpenRouter returned error", { msg: data.error.message || data.error });
            return null;
        }
        const scoreText = (data?.choices?.[0]?.message?.content || "").trim();
        log("JUDGE_RAW", `Model raw reply: "${scoreText}"`);
        const score = Math.min(100, Math.max(0, parseInt(scoreText.match(/\d+/)?.[0] ?? "50", 10)));
        return score;
    } catch(err) {
        log("JUDGE_ERROR", "Evaluation failed", { err: err.message });
        return null;
    }
}

/**
 * Attempt on-chain slash via admin key. Falls back to a hub-store soft-slash if the
 * contract call fails (e.g. admin key mismatch or contract state issue).
 *
 * @param {string} hunterAddr  - Full Stellar public key of the hunter (for hub store update).
 * @param {string} agentId     - On-chain agent symbol (e.g. "bounty_hunter_XYZABC").
 * @param {number} amount      - XLM amount to slash.
 * @param {string} reason      - Short reason string.
 */
function slashStakeOnChain(hunterAddr, agentId, amount, reason) {
    const secretKey = process.env.ADMIN_SECRET_KEY;
    if (!secretKey) {
        log("SLASH_ERROR", "ADMIN_SECRET_KEY not set in .env — cannot slash");
        return;
    }
    const toSymbol = (id) => id.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const safeAgentId = toSymbol(agentId);
    const safeReason  = toSymbol(reason);
    const stroops     = Math.round(amount * 10_000_000).toString();
    const amountInStroops = parseInt(stroops, 10);

    log("SLASH_INIT", `Slashing ${amount} XLM from ${safeAgentId}`, { reason, hunterAddr });

    const auth = ["--source", secretKey, "--network", "testnet"];
    const result = spawnSync("stellar", [
        "contract", "invoke", "--id", CONTRACT_ID, ...auth, "--",
        "slash_stake", "--agent_id", safeAgentId, "--amount", stroops, "--reason", safeReason
    ], { encoding: "utf-8" });

    if (result.status === 0 && !result.error) {
        log("SLASH_SUCCESS", `On-chain slash OK: ${safeAgentId} -${amount} XLM`);
        // Sync hub store to match chain state
        if (hunterAddr && store.identities[hunterAddr]) {
            const agent = store.identities[hunterAddr];
            agent.stake     = Math.max(0, (agent.stake || 0) - amountInStroops);
            agent.stake_xlm = agent.stake / 10_000_000;
            saveStore();
        }
    } else {
        log("SLASH_FAIL", `On-chain slash FAILED for ${safeAgentId} — applying soft hub penalty`, { stderr: result.stderr?.trim() });
        // Soft slash: deduct from hub store only so dashboard reflects the penalty
        if (hunterAddr && store.identities[hunterAddr]) {
            const agent = store.identities[hunterAddr];
            agent.stake     = Math.max(0, (agent.stake || 0) - amountInStroops);
            agent.stake_xlm = agent.stake / 10_000_000;
            if (!agent.slashHistory) agent.slashHistory = [];
            agent.slashHistory.push({ reason, amountXLM: amount, onChain: false, timestamp: new Date().toISOString() });
            saveStore();
            log("SLASH_SOFT", `Hub-store soft-slash recorded for ${hunterAddr} (-${amount} XLM)`);
        }
    }
}

app.post('/api/tasks/:taskId/upload', upload.array('files'), (req, res) => {
    const { taskId } = req.params;
    const { addr } = req.body;
    const task = store.tasks[taskId];

    if (!task) return res.status(404).json({ error: "Task not found" });
    
    // Authorization: Only assigned hunter can upload
    if (task.bountyHunterAddr && task.bountyHunterAddr !== addr) {
        return res.status(403).json({ error: "Forbidden: Not the assigned hunter" });
    }

    if (!task.deliverables) task.deliverables = [];

    const newFiles = (req.files || []).map(f => ({
        originalName: f.originalname,
        filename: f.filename,
        mimetype: f.mimetype,
        size: f.size,
        uploadedAt: new Date().toISOString()
    }));

    task.deliverables.push(...newFiles);
    saveStore();

    log("UPLOAD", "Artifacts stored", { taskId, count: newFiles.length });
    
    // AI Vision Judging — async, does not block the upload response
    const hunterAddr = task.bountyHunterAddr || addr;

    judgeWork(task.title, newFiles).then(score => {
        log("JUDGE_RESULT", `Task ${taskId} scored ${score}/100.`);
        // Persist score on the task so dashboard can surface it
        task.judgeScore = score;
        task.judgedAt   = new Date().toISOString();
        saveStore();

        if (score !== null && score < 33) {
            log("JUDGE_PENALTY", `Score ${score}/100 — triggering hunter penalty...`);
            const agentId = `bounty_hunter_${hunterAddr.slice(-6)}`;
            slashStakeOnChain(hunterAddr, agentId, 50, "LOW_QUALITY_SUBMISSION");
        }
    }).catch(e => log("JUDGE_ERROR", "Async judge fail", { err: e.message }));

    res.json({ success: true, files: newFiles });
});

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

        // Enrich deliverables with base64 content + direct download URL for AI viewing
        const artifacts = (task.deliverables || []).map(f => {
            const filePath = path.join(uploadDir, f.filename);
            const mime = getMimeType(f.originalName, f.mimetype);
            const enriched = {
                ...f,
                // url is the stable, directly-serveable path contractors/AI can use
                url: `http://localhost:${HUB_PORT}/api/files/${encodeURIComponent(f.filename)}`,
                mimeType: mime
            };
            if (fs.existsSync(filePath)) {
                enriched.content = fs.readFileSync(filePath).toString('base64');
            }
            return enriched;
        });

        return res.json({
            success: true,
            payload: task.workNote || "CONFIDENTIAL_DELIVERY_DATA",
            deliverables: artifacts,
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
        addr: data?.addr,
        ...(data?.bounty_hunter ? { bounty_hunter: data.bounty_hunter } : {})
    });

    store.eventLog.push({ event, data, timestamp: now });

    switch (event) {

        // ------------------ IDENTITY ------------------
        case 'reg':
            log("IDENTITY", "Register/update", data);

            const formatName = (n) => n ? (n.startsWith('@') ? n : `@${n}`) : "Unnamed Agent";

            if (!store.identities[data.addr]) {
                store.identities[data.addr] = {
                    addr: data.addr,
                    name: formatName(data.name),
                    roles: [data.role],
                    capabilities: data.capabilities || [],
                    stakes: { [data.role]: data.stake },
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

                // Initialize stakes map if it doesn't exist (migration)
                if (!agent.stakes) agent.stakes = { [agent.roles[0]]: agent.stake || 0 };

                // Add or update the role-specific stake
                agent.stakes[data.role] = data.stake;

                // Update total aggregate stake
                agent.stake = Object.values(agent.stakes).reduce((acc, s) => acc + s, 0);
                agent.stake_xlm = agent.stake / 10_000_000;

                // Update off-chain metadata if provided
                if (data.name) agent.name = formatName(data.name);
                if (data.capabilities) agent.capabilities = data.capabilities;
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
// 5. FILE SERVING — direct download for uploaded artifacts
// ---------------------------------------------------------------------------
app.get('/api/files/:filename', (req, res) => {
    const { filename } = req.params;
    // Sanitize: only allow safe filename characters
    if (!/^[\w\-. ]+$/.test(filename)) {
        return res.status(400).json({ error: "Invalid filename" });
    }
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }
    // Override the global application/json header for file downloads
    res.removeHeader('Content-Type');
    res.sendFile(filePath);
});

// ---------------------------------------------------------------------------
// 6. HEALTH
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