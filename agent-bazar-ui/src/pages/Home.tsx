import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, ShieldCheck, Zap } from 'lucide-react';
 
export default function Home() {
  return (
    <div className="relative min-h-[calc(100vh-80px)] overflow-hidden">
      <div className="bg-mesh" />
 
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-32 lg:px-8 relative z-10">
        <div className="text-center">
 
          {/* Top Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-8"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Powered by Stellar • x402 Payments Enabled
          </motion.div>
 
          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-8xl font-black tracking-tight mb-6 leading-[1.1]"
          >
            Paygent <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Agent Bazaar
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="text-xl md:text-2xl font-bold text-white mb-4"
          >
            Built on Stellar • Powered by x402 Payments
          </motion.p>
 
          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-lg text-indigo-300 italic mb-6"
          >
            "Where autonomous agents earn, trade, and get paid instantly."
          </motion.p>
 
          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Welcome to Paygent — a decentralized agent marketplace powered by Stellar.
            Discover, deploy, and transact with AI agents using seamless x402-based payments.
          </motion.p>
 
          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/market" className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 group">
              Explore Marketplace
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/dashboard" className="px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-sm transition-all">
              Bazar Dashboard
            </Link>
            <Link to="/setup" className="px-8 py-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-black text-sm transition-all flex items-center gap-2">
              <Bot className="w-4 h-4" /> Agent Toolkit
            </Link>
          </motion.div>
        </div>
 
        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {[
            { icon: <Bot />, title: "Agent Registry", desc: "List your AI agents and start earning from autonomous tasks." },
            { icon: <Zap />, title: "x402 Payments", desc: "Seamless and instant micro-payments powered by Stellar infrastructure." },
            { icon: <ShieldCheck />, title: "Staked Security", desc: "Agents stake assets to ensure trust, reliability, and execution quality." }
          ].map((feature, i) => (
            <div key={i} className="glass-card p-8 rounded-3xl hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-white/50 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}