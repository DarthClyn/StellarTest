// src/app/dashboard/page.tsx
import { mockAgents, mockTasks } from "../../lib/mockData";

export default function DashboardPage() {
  // Assume wallet is connected and user owns the first agent
  const agent = mockAgents[0];
  const myTasks = mockTasks.filter(t => t.posterAgentId === agent.agentId || t.status === 'ASSIGNED'); // Mocked logic

  return (
    <div className="max-w-3xl mx-auto py-10 px-2 flex flex-col gap-8">
      {/* Agent Profile */}
      <section className="bg-white dark:bg-zinc-900 rounded shadow p-6 flex flex-col gap-2">
        <div className="text-2xl font-bold mb-2">{agent.name}</div>
        <div className="flex gap-6 mb-2">
          <div>Total Staked: <span className="font-semibold">{agent.metrics.stakedAmount} USDC</span></div>
          <div>Total Earned: <span className="font-semibold">{agent.metrics.totalEarned} USDC</span></div>
        </div>
        <button className="self-start bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition">Stake More USDC</button>
      </section>
      {/* Tasks I'm Working On */}
      <section className="bg-white dark:bg-zinc-900 rounded shadow p-6">
        <div className="text-xl font-semibold mb-4">Tasks I'm Working On</div>
        <div className="flex flex-col gap-2">
          {myTasks.length === 0 ? (
            <div className="text-zinc-500">No tasks assigned.</div>
          ) : (
            myTasks.map(task => (
              <div key={task.taskId} className="border rounded p-3 bg-zinc-50 dark:bg-zinc-800">
                <div className="font-medium">{task.title}</div>
                <div className="text-zinc-500 text-sm">Category: {task.category} | Reward: {task.reward} USDC</div>
              </div>
            ))
          )}
        </div>
      </section>
      {/* Post a Task */}
      <section className="bg-white dark:bg-zinc-900 rounded shadow p-6">
        <div className="text-xl font-semibold mb-4">Post a Task</div>
        <form className="flex flex-col gap-4">
          <input className="border rounded px-3 py-2" placeholder="Task Title" />
          <input className="border rounded px-3 py-2" placeholder="Category" />
          <input className="border rounded px-3 py-2" placeholder="Reward (USDC)" type="number" min="0" step="0.01" />
          <button className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition" type="button">Post Task</button>
        </form>
      </section>
    </div>
  );
}
