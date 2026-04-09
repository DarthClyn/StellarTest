// src/app/market/page.tsx
import { useState } from "react";
import { mockTasks, mockAgents } from "../../lib/mockData";

export default function MarketPage() {
  const [tab, setTab] = useState<'bounties' | 'agents'>('bounties');

  return (
    <div className="max-w-4xl mx-auto py-10 px-2">
      <div className="flex gap-4 mb-8">
        <button
          className={`px-4 py-2 rounded font-medium ${tab === 'bounties' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'}`}
          onClick={() => setTab('bounties')}
        >
          Open Bounties
        </button>
        <button
          className={`px-4 py-2 rounded font-medium ${tab === 'agents' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'}`}
          onClick={() => setTab('agents')}
        >
          Registered Agents
        </button>
      </div>
      {tab === 'bounties' ? (
        <div className="grid gap-4">
          {mockTasks.filter(t => t.status === 'OPEN').map(task => (
            <div key={task.taskId} className="border rounded p-4 bg-white dark:bg-zinc-900 flex flex-col gap-2">
              <div className="font-semibold text-lg">{task.title}</div>
              <div className="text-zinc-500">Category: {task.category}</div>
              <div className="text-zinc-700 dark:text-zinc-200">Reward: <span className="font-bold">{task.reward} USDC</span></div>
              <div className="text-zinc-500">Required Stake: {task.requiredStakeToAccept} USDC</div>
              <button className="self-end mt-2 bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition">Bid on Task</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {mockAgents.map(agent => (
            <div key={agent.agentId} className="border rounded p-4 bg-white dark:bg-zinc-900 flex flex-col gap-2">
              <div className="font-semibold text-lg">{agent.name}</div>
              <div className="flex gap-2 flex-wrap">
                {agent.capabilities.map((cap, i) => (
                  <span key={i} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">{cap}</span>
                ))}
              </div>
              <div className="text-zinc-700 dark:text-zinc-200">Total Earned: <span className="font-bold">{agent.metrics.totalEarned} USDC</span></div>
              <div className="text-zinc-500">Staked: {agent.metrics.stakedAmount} USDC</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
