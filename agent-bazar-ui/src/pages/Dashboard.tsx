import { motion } from "framer-motion";
import { mockAgents, mockTasks } from "../mockData";
import { 
  Activity, 
  CreditCard, 
  CheckCircle2, 
  Settings, 
  Cpu, 
  ExternalLink,
  ArrowUpRight,
  Rocket
} from "lucide-react";

export default function Dashboard() {
  const myAgent = mockAgents[0];
  const assignedTasks = mockTasks.filter(t => t.assigneeAgentId === myAgent.agentId);

  const stats = [
    { label: "Total Tasks", value: myAgent.metrics.tasksCompleted, icon: <CheckCircle2 className="w-5 h-5 text-indigo-400" />, trend: "+12%" },
    { label: "Revenue", value: `${myAgent.metrics.totalEarned} USDC`, icon: <CreditCard className="w-5 h-5 text-green-400" />, trend: "+8.4%" },
    { label: "Uptime", value: "99.9%", icon: <Activity className="w-5 h-5 text-purple-400" />, trend: "Stable" },
  ];

  return (
    <div className="min-h-screen pt-20 pb-32">
      <div className="bg-mesh" />
      
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <header className="flex justify-between items-center mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Cpu className="w-8 h-8 text-indigo-500" />
              <h1 className="text-4xl font-black">Control Panel</h1>
            </div>
            <p className="text-white/40 font-medium">Monitoring agent <span className="text-white">{myAgent.name}</span></p>
          </div>
          <button className="btn-secondary flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Agent Settings
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stats.map((stat, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={stat.label} 
              className="glass-card p-8 rounded-3xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  {stat.icon}
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${stat.trend.startsWith('+') ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/40'}`}>
                  {stat.trend}
                </span>
              </div>
              <p className="text-white/40 text-sm font-bold uppercase tracking-wider mb-2">{stat.label}</p>
              <h3 className="text-3xl font-black">{stat.value}</h3>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              Active Assignments
              <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded-full">{assignedTasks.length}</span>
            </h2>
            
            <div className="space-y-4">
              {assignedTasks.map((task, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + (i * 0.1) }}
                  key={task.taskId} 
                  className="glass-card p-6 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all border-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                      <Rocket className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">{task.title}</h4>
                      <p className="text-white/30 text-xs">Tracking ID: {task.taskId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-bold text-white/40 uppercase mb-1">Incentive</p>
                      <p className="text-lg font-black text-green-400">+{task.reward} USDC</p>
                    </div>
                    <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                      <ExternalLink className="w-5 h-5 text-white/60" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Quick Actions</h2>
            <div className="glass-card p-6 rounded-3xl space-y-3">
              {[
                "Pause Operations",
                "Withdraw Earnings",
                "Update Capabilities",
                "View Log History"
              ].map(action => (
                <button key={action} className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-indigo-600/20 hover:text-indigo-400 transition-all group font-bold text-sm">
                  {action}
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              ))}
            </div>

            <div className="glass-card p-6 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/20">
              <h4 className="font-bold mb-2">Need Help?</h4>
              <p className="text-sm text-white/50 mb-4">Our documentation covers everything you need to scale your agents.</p>
              <button className="text-indigo-400 font-bold text-sm hover:underline">Read Docs →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
