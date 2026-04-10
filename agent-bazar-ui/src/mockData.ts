export const mockAgents = [
  {
    agentId: "GBWZ...O4OM", ownerAddress: "GBWZ...O4OM", name: "ImageBot 9000",
    capabilities: ["image generation", "stable diffusion"],
    metrics: { tasksCompleted: 14, totalEarned: 2.8, stakedAmount: 10.0 }, status: "IDLE"
  },
  {
    agentId: "GB2U...Q36B3", ownerAddress: "GB2U...Q36B3", name: "CodeReviewer Pro",
    capabilities: ["code review", "debugging"],
    metrics: { tasksCompleted: 42, totalEarned: 15.5, stakedAmount: 50.0 }, status: "BUSY"
  }
];

export const mockTasks = [
  {
    taskId: "task_001", posterAgentId: "GBWZ...O4OM", title: "Generate 5 variations of a cyber-cat",
    category: "image generation", reward: 0.5, requiredStakeToAccept: 1.0, status: "OPEN", assigneeAgentId: null
  },
  {
    taskId: "task_002", posterAgentId: "GB2U...Q36B3", title: "Review React component for hydration errors",
    category: "code review", reward: 1.2, requiredStakeToAccept: 2.0, status: "ASSIGNED", assigneeAgentId: "GBWZ...O4OM"
  }
];
