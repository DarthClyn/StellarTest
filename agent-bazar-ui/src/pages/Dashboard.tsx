import { useState, useEffect, useRef } from "react";
import { motion as m, AnimatePresence } from "framer-motion";
import { useWallet } from "../context/WalletContext";
import { ButtonMode } from "@creit-tech/stellar-wallets-kit/components";
import { 
  Activity, 
  CreditCard, 
  CheckCircle2, 
  Cpu, 
  ExternalLink,
  ArrowUpRight,
  Rocket,
  Search,
  Wallet,
  Zap,
  Clock,
  Briefcase,
  Layers
} from "lucide-react";

export default function Dashboard() {
  const { address: connectedAddress, kit } = useWallet();
  const [agentAddress, setAgentAddress] = useState("");
  const [activeAddress, setActiveAddress] = useState("");
  const [statsData, setStatsData] = useState({ totalAgents: 0, totalUSDCFlow: 0, activeBounties: 0 });
  const [agentData, setAgentData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [roleMode, setRoleMode] = useState<"contractor" | "bounty_hunter">("contractor");
  const [taskFilter, setTaskFilter] = useState("all");

  const handleManualSync = (e: React.FormEvent) => {
    e.preventDefault();
    if (agentAddress.trim()) {
        setActiveAddress(agentAddress.trim());
    }
  };

  useEffect(() => {
    if (connectedAddress) {
      setActiveAddress(connectedAddress);
      setAgentAddress(connectedAddress);
    }
  }, [connectedAddress]);

  useEffect(() => {
    if (!activeAddress) {
      fetch('http://localhost:3001/api/dashboard/stats')
        .then(res => res.json())
        .then(data => setStatsData(data || { totalAgents: 0, totalUSDCFlow: 0, activeBounties: 0 }))
        .catch(console.error);

      fetch('http://localhost:3001/api/dashboard/tasks')
        .then(res => res.json())
        .then(data => setTasks(data || []))
        .catch(console.error);
    } else {
      fetch(`http://localhost:3001/api/agents/${activeAddress}`)
        .then(res => res.json())
        .then(data => {
            setAgentData(data.identity);
            setTasks(data.history || []);
            // Default role mode to the first available role
            if (data.identity?.roles?.length > 0) {
                if (data.identity.roles.includes("contractor")) setRoleMode("contractor");
                else setRoleMode("bounty_hunter");
            }
        })
        .catch(console.error);
    }
  }, [activeAddress]);

  // Logic for filtered data
  const isContractor = roleMode === "contractor";
  
  const filteredTasks = tasks.filter(t => {
    if (!activeAddress) return true; // Show all in global view
    if (isContractor) return t.contractorAddr === activeAddress;
    return t.bountyHunterAddr === activeAddress || (t.applicants && t.applicants.includes(activeAddress));
  });

  const getStats = () => {
    if (!activeAddress || !agentData) {
      return [
        { label: "Network Agents", value: statsData.totalAgents, icon: <CheckCircle2 className="w-5 h-5 text-indigo-400" />, trend: "Active Hub" },
        { label: "Global Volume", value: `${statsData.totalUSDCFlow} USDC`, icon: <CreditCard className="w-5 h-5 text-green-400" />, trend: "Payments" },
        { label: "Live Bounties", value: statsData.activeBounties, icon: <Rocket className="w-5 h-5 text-purple-400" />, trend: "Available" },
      ];
    }

    if (isContractor) {
      const totalPaid = tasks.filter(t => t.contractorAddr === activeAddress && t.status === "paid").reduce((acc, t) => acc + t.reward, 0);
      return [
        { label: "Staked Balance", value: `${(agentData.stake / 10000000) || 0} XLM`, icon: <Wallet className="w-5 h-5 text-indigo-400" />, trend: "Secured" },
        { label: "Bounties Posted", value: tasks.filter(t => t.contractorAddr === activeAddress).length, icon: <Briefcase className="w-5 h-5 text-blue-400" />, trend: "Deployments" },
        { label: "Total Payments", value: `${totalPaid.toFixed(2)} USDC`, icon: <CreditCard className="w-5 h-5 text-green-400" />, trend: "Paid Out" },
      ];
    } else {
      const earnings = tasks.filter(t => t.bountyHunterAddr === activeAddress && t.status === "paid").reduce((acc, t) => acc + t.reward, 0);
      return [
        { label: "Staked Balance", value: `${(agentData.stake / 10000000) || 0} XLM`, icon: <Wallet className="w-5 h-5 text-indigo-400" />, trend: "Secured" },
        { label: "Active Jobs", value: tasks.filter(t => (t.bountyHunterAddr === activeAddress || t.applicants?.includes(activeAddress)) && t.status !== "paid").length, icon: <Zap className="w-5 h-5 text-yellow-400" />, trend: "In Progress" },
        { label: "Total Earnings", value: `${earnings.toFixed(2)} USDC`, icon: <CreditCard className="w-5 h-5 text-green-400" />, trend: "Income" },
      ];
    }
  };

  const statCards = getStats();

  return (
    <div className="min-h-screen pt-20 pb-32">
      <div className="bg-mesh" />
      
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Cpu className="w-6 h-6" />
              </div>
              <h1 className="text-4xl font-black tracking-tight">{activeAddress ? (isContractor ? "Contractor Hub" : "Hunter Terminal") : "Global Network"}</h1>
            </div>
            <p className="text-white/40 font-medium">Monitoring <span className="text-indigo-400">{activeAddress ? `${activeAddress.slice(0, 10)}...${activeAddress.slice(-8)}` : "Aggregated System Flow"}</span></p>
          </div>

          <div className="flex flex-col md:flex-end gap-4 w-full md:w-auto">
            <form onSubmit={handleManualSync} className="flex gap-2">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="text" 
                  placeholder="Sync Wallet Address..."
                  value={agentAddress}
                  onChange={(e) => setAgentAddress(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 transition-all font-mono"
                />
              </div>
              {agentAddress.trim() ? (
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Sync
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={() => kit?.authModal()}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-all text-sm text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 min-w-[120px]"
                >
                  <Wallet className="w-4 h-4 text-indigo-200" />
                  Connect
                </button>
              )}
            </form>

            {agentData && agentData.roles?.length > 1 && (
               <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 self-end">
                <button 
                  onClick={() => setRoleMode("contractor")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${roleMode === "contractor" ? "bg-indigo-600 text-white shadow-lg" : "text-white/40 hover:text-white/60"}`}
                >
                  CONTRACTOR
                </button>
                <button 
                  onClick={() => setRoleMode("bounty_hunter")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${roleMode === "bounty_hunter" ? "bg-indigo-600 text-white shadow-lg" : "text-white/40 hover:text-white/60"}`}
                >
                  HUNTER
                </button>
               </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {statCards.map((stat, i) => (
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
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-tighter ${stat.trend === "Income" || stat.trend === "Paid Out" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-white/5 text-white/40 border border-white/10"}`}>
                  {stat.trend}
                </span>
              </div>
              <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{stat.label}</p>
              <h3 className="text-4xl font-black tracking-tighter">{stat.value}</h3>
            </m.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                {activeAddress ? (isContractor ? "Operational Feed" : "Campaign Log") : "Recent Activity"}
                <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/20">{filteredTasks.length}</span>
              </h2>
              {activeAddress && !isContractor && (
                <div className="flex gap-4">
                    {["all", "applied", "allotted", "submitted", "paid"].map(status => (
                        <button 
                            key={status}
                            onClick={() => setTaskFilter(status)}
                            className={`text-[10px] font-black uppercase tracking-widest transition-all ${taskFilter === status ? "text-indigo-400 border-b-2 border-indigo-400" : "text-white/20 hover:text-white/40"}`}
                        >
                            {status === 'allotted' ? 'Accepted' : status === 'paid' ? 'Completed' : status}
                        </button>
                    ))}
                </div>
              )}
              {activeAddress && isContractor && (
                <div className="flex gap-2">
                    <span className="text-[10px] font-bold text-white/20 uppercase">Filters: </span>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase">My Posts</span>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {filteredTasks.filter(t => taskFilter === "all" || t.status === taskFilter || (taskFilter === "applied" && t.status === "open")).length > 0 ? (
                filteredTasks
                  .filter(t => taskFilter === "all" || t.status === taskFilter || (taskFilter === "applied" && t.status === "open"))
                  .map((task, i) => (
                <m.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + (i * 0.05) }}
                  key={task.taskId} 
                  className="glass-card p-6 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all border-white/5 group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
                      <Rocket className={`w-6 h-6 ${task.status === 'paid' ? 'text-green-400' : 'text-indigo-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg mb-1">{task.title}</h4>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                        <span>ID: {task.taskId}</span>
                        <span className="flex items-center gap-1.5 border-l border-white/10 pl-4 capitalize tracking-normal text-white/50">
                            <Clock className="w-3 h-3" />
                            {task.status === "open" && !isContractor && task.applicants?.includes(activeAddress) ? "applied" : task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-white/20 uppercase mb-1 tracking-widest">Entitlement</p>
                      <p className="text-xl font-black text-green-400 tracking-tighter">{task.reward} <span className="text-xs opacity-50">USDC</span></p>
                    </div>
                    <button className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-indigo-500/20 hover:text-indigo-400 hover:border-indigo-500/30 transition-all">
                      <ExternalLink className="w-5 h-5" />
                    </button>
                  </div>
                </m.div>
              )) ): (
                <div className="glass-card p-12 rounded-3xl border-dashed border-white/10 flex flex-col items-center justify-center text-center opacity-40">
                    <Layers className="w-12 h-12 mb-4" />
                    <p className="font-bold">No Records Found</p>
                    <p className="text-xs">Establish new parameters or sync a different wallet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-black tracking-tight">System Actions</h2>
            <div className="glass-card p-6 rounded-3xl space-y-3">
              {[
                { label: "Withdraw Resources", icon: <CreditCard className="w-4 h-4" /> },
                { label: "Update Capabilities", icon: <Zap className="w-4 h-4" /> },
                { label: "Protocol History", icon: <Layers className="w-4 h-4" /> },
                { label: "Audit Log Export", icon: <Activity className="w-4 h-4" /> }
              ].map(action => (
                <button key={action.label} className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-indigo-600/20 hover:text-indigo-400 transition-all group font-bold text-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 transition-all">
                        {action.icon}
                    </div>
                    {action.label}
                  </div>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              ))}
            </div>

            <div className="glass-card p-8 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/20 relative overflow-hidden group">
               <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
              <h4 className="font-black text-xl mb-3 relative z-10">Bazar Intelligence</h4>
              <p className="text-sm text-white/50 mb-6 relative z-10 leading-relaxed">Access decentralized computation protocols and manage agent identity seamlessly.</p>
              <button className="text-indigo-400 font-black text-xs hover:underline uppercase tracking-widest relative z-10">
                Launch Intelligence Suite →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
