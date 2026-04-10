import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mockTasks, mockAgents } from "../mockData";
import { Search, Filter, Rocket, TrendingUp, Users } from "lucide-react";

export default function Market() {
  const [activeTab, setActiveTab] = useState<"bounties" | "agents">("bounties");
  const openBounties = mockTasks.filter(t => t.status === "OPEN");

  return (
    <div className="min-h-screen pt-20 pb-32">
      <div className="bg-mesh" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-4">Discovery</h1>
            <p className="text-white/50 text-lg">Find the best AI agents or post a custom bounty.</p>
          </div>
          
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-sm">
            {[
              { id: 'bounties', label: 'Bounties', icon: <Rocket className="w-4 h-4" /> },
              { id: 'agents', label: 'Agents', icon: <Users className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300
                  ${activeTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="market-tab"
                    className="absolute inset-0 bg-indigo-600 rounded-xl -z-10 shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by name, capability or category..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
          <button className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2 hover:bg-white/10 transition-all font-bold">
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'bounties' ? (
            <motion.div 
              key="bounties"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {openBounties.map(task => (
                <div key={task.taskId} className="glass-card group p-8 rounded-3xl hover:bg-white/10 transition-all border-white/5 hover:border-white/20 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase border border-indigo-500/20">
                        {task.category}
                      </span>
                      <TrendingUp className="w-5 h-5 text-green-400 opacity-50" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 group-hover:text-indigo-400 transition-colors">{task.title}</h3>
                    <div className="flex items-center justify-between py-4 border-y border-white/5 mb-8">
                      <span className="text-white/40 text-sm font-medium">Bounty Reward</span>
                      <span className="text-2xl font-black text-green-400 font-mono tracking-tighter">
                        {task.reward} <span className="text-xs uppercase opacity-60">USDC</span>
                      </span>
                    </div>
                  </div>
                  <button className="btn-primary w-full flex items-center justify-center gap-2">
                    Accept Bounty
                  </button>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="agents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {mockAgents.map(agent => (
                <div key={agent.agentId} className="glass-card p-8 rounded-3xl hover:-translate-y-1 transition-all border-white/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl">
                      🤖
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{agent.name}</h3>
                      <p className="text-white/30 text-xs font-mono">{agent.ownerAddress.slice(0, 6)}...{agent.ownerAddress.slice(-4)}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-8">
                    {agent.capabilities.map(cap => (
                      <span key={cap} className="bg-white/5 text-[10px] font-bold text-white/50 px-2.5 py-1 rounded-lg border border-white/5">
                        {cap}
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-6 border-t border-white/5">
                    <div className="flex flex-col">
                      <span className="text-white/30 text-[10px] font-black uppercase tracking-wider mb-1">Total Earned</span>
                      <span className="text-lg font-black text-green-400">{agent.metrics.totalEarned} USDC</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-white/30 text-[10px] font-black uppercase tracking-wider mb-1">Success Rate</span>
                      <span className="text-lg font-black text-indigo-400">98%</span>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
