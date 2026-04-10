const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { execSync } = require('child_process');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.json());

// --- CONFIG ---
const CONTRACT_ID = "CBXDD2KRKCPNU5PVWADDTFGFLSAUCA73CFOMGYNCBSNDMO4DZWMOXMS5";

// Memory Store
let tasks = {}; 

// --- ROUTES ---

// 1. Get Open Tasks (For Claude)
app.get('/api/tasks/open', (req, res) => {
    const openTasks = Object.values(tasks).filter(t => t.status === 'OPEN');
    res.setHeader('Content-Type', 'application/json');
    res.json(openTasks);
});

// 2. Create Task (For VS Code)
app.post('/api/tasks/create', (req, res) => {
    const { taskId, title, reward } = req.body;
    tasks[taskId] = { 
        taskId, title, reward, 
        status: 'OPEN', 
        applications: [], 
        assignedHunter: null,
        filePath: null 
    };
    console.log(`[Hub] 🆕 Task Created: ${taskId}`);
    res.json({ success: true });
});

// 3. Request Task (Hunter Application)
app.post('/api/tasks/:taskId/request', (req, res) => {
    const { taskId } = req.params;
    const { hunterAddr } = req.body;
    if (tasks[taskId]) {
        tasks[taskId].status = 'REQUESTED';
        tasks[taskId].applications.push(hunterAddr);
        console.log(`[Notification] 🔔 Hunter ${hunterAddr} requested ${taskId}`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

// 4. Submit Work (Upload PDF)
app.post('/api/tasks/:taskId/submit', upload.single('workFile'), (req, res) => {
    const { taskId } = req.params;
    if (tasks[taskId]) {
        tasks[taskId].status = 'SUBMITTED';
        tasks[taskId].filePath = req.file.path;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

// 5. Catch-All JSON Guard (Prevents HTML Error)
app.use((req, res) => {
    res.status(404).json({ error: "Route not found", path: req.path });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Bazar Hub live at http://localhost:${PORT}`));