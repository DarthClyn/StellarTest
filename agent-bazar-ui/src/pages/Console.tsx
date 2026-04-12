import { useState, useEffect } from "react";
import { motion as m } from "framer-motion";
import { 
  CreditCard, 
  Layers, 
  Zap,
  Activity,
  ArrowUpRight
} from "lucide-react";

export default function Console() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/dashboard/tasks')
      .then(res => res.json())
      .then(data => setTasks(data || []))
      .catch(console.error);
  }, []);

  const paidTasks = tasks.filter(t => t.status === "paid");
  const totalVolume = paidTasks.reduce((acc, t) => acc + t.reward, 0);
  const meanBounty = paidTasks.length > 0 ? (totalVolume / paidTasks.length).toFixed(2) : "0.00";

  const stats = [
    { label: "Global Ledger", value: paidTasks.length, icon: <Layers className="w-5 h-5 text-indigo-400" />, trend: "X402 Records" },
    { label: "Consolidated Volume", value: `${totalVolume.toFixed(2)} USDC`, icon: <CreditCard className="w-5 h-5 text-green-400" />, trend: "Settled" },
    { label: "Mean Bounties", value: `${meanBounty} USDC`, icon: <Zap className="w-5 h-5 text-yellow-400" />, trend: "Average Reward" },
  ];

  return (
    <div className="min-h-screen pt-20 pb-32">
      <div className="bg-mesh" />
      
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Activity className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white">X402 Network Hub</h1>
          </div>
          <p className="text-white/40 font-medium tracking-wide">Autonomous Settlement Protocol & Real-Time Financial Ledger</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stats.map((stat, i) => (
            <m.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={stat.label} 
              className="glass-card p-8 rounded-3xl group hover:border-white/20 transition-all overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all" />
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                  {stat.icon}
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-tighter ${stat.trend === "Settled" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-white/5 text-white/40 border border-white/10"}`}>
                  {stat.trend}
                </span>
              </div>
              <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{stat.label}</p>
              <h3 className="text-4xl font-black tracking-tighter text-white">{stat.value}</h3>
            </m.div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              Platform Ledger
              <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/20">{paidTasks.length}</span>
            </h2>
            <div className="flex gap-2">
                <span className="text-[10px] font-bold text-white/20 uppercase">Network: </span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase">Testnet / Soroban</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {paidTasks.length > 0 ? (
              paidTasks.map((task, i) => (
                <m.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + (i * 0.05) }}
                  key={task.taskId} 
                  className="glass-card p-6 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all border-white/5 group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all text-green-400">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg mb-1">{task.title}</h4>
                      <div className="flex items-center gap-4 text-[10px] font-black tracking-widest text-white/40 uppercase">
                        <div className="flex flex-col items-center">
                          <span className="text-white/20 mb-1">Contractor</span>
                          <span className="text-indigo-400">{task.contractorAddr?.slice(0, 6)}...{task.contractorAddr?.slice(-4)}</span>
                        </div>
                        <div className="w-4 h-[1px] bg-white/10" />
                        <div className="flex flex-col items-center">
                          <span className="text-white/20 mb-1">Successors</span>
                          <span className="text-purple-400">{task.bountyHunterAddr?.slice(0, 6)}...{task.bountyHunterAddr?.slice(-4)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-white/20 uppercase mb-1 tracking-widest">Settled Hash</p>
                      <p className="text-xs font-mono text-indigo-400/80">{task.onChainHash?.slice(0, 10)}...{task.onChainHash?.slice(-8)}</p>
                    </div>
                    <div className="flex flex-col items-end">
                         <p className="text-[10px] font-black text-white/20 uppercase mb-1 tracking-widest">Revenue</p>
                         <p className="text-sm font-black text-green-400">+{task.reward} USDC</p>
                    </div>
                  </div>
                </m.div>
              ))
            ) : (
              <div className="glass-card p-20 rounded-3xl border-dashed border-white/10 flex flex-col items-center justify-center text-center opacity-40">
                  <Activity className="w-16 h-16 mb-4 text-white/20" />
                  <p className="font-bold text-xl text-white">Ledger Empty</p>
                  <p className="text-sm text-white/50">Waiting for successful X402 settlements on the Testnet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
