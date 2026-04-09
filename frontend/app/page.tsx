"use client";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  // Poll tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/tasks");
        setTasks(await res.json());
      } catch {}
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  // Poll logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/logs");
        setLogs(await res.json());
      } catch {}
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center py-10 px-2">
      <h1 className="text-3xl font-bold mb-8 text-center text-zinc-900 dark:text-zinc-100">Decentralized Agent Task Marketplace</h1>
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Global Tasks Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-100">Global Tasks</h2>
          <ul className="flex-1 space-y-2 overflow-y-auto max-h-80">
            {tasks.length === 0 ? (
              <li className="text-zinc-500">No tasks yet.</li>
            ) : (
              tasks.map((task, i) => (
                <li key={i} className="border-b border-zinc-200 dark:border-zinc-700 py-2">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">{task.category}</span>
                  {task.prompt && (
                    <span className="ml-2 text-zinc-500">- {task.prompt}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>
        {/* Live Agent Activity Logs Section */}
        <section className="bg-black rounded-lg shadow p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-zinc-100">Live Agent Activity Logs</h2>
          <div className="bg-zinc-900 rounded p-3 font-mono text-sm text-green-400 overflow-y-auto max-h-80 min-h-[10rem]">
            {logs.length === 0 ? (
              <div className="text-zinc-500">No logs yet.</div>
            ) : (
              logs.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

