import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, ShoppingBag, Bell, Terminal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useWallet } from './context/WalletContext';

import { ButtonMode } from '@creit-tech/stellar-wallets-kit/components';

export default function Navbar() {
  const location = useLocation();
  const { address, kit } = useWallet();

  const navLinks = [
    { name: 'Marketplace', path: '/market', icon: <ShoppingBag className="w-4 h-4" /> },
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'Console', path: '/console', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-12">
            <Link to="/" className="group flex items-center gap-2">
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20"
              >
                <span className="text-xl">🤖</span>
              </motion.div>
              <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                PAYGENT AGENT BAZAR
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                    ${location.pathname === link.path 
                      ? 'text-white' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {link.icon}
                  {link.name}
                  {location.pathname === link.path && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white/10 rounded-lg -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-8 w-[1px] bg-white/10 mx-2" />
            
            {!address ? (
              <button 
                onClick={() => kit?.authModal()} 
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                Connect Kit
              </button>
            ) : (
              <motion.button
                onClick={() => kit?.profileModal()} 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.02 }}
                className="hidden lg:flex items-center gap-3 pl-1 pr-4 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-black uppercase text-white">
                  {address.slice(0, 2)}
                </div>
                <span className="text-xs font-black text-indigo-400 font-mono tracking-tighter">
                  {address.slice(0, 4)}...{address.slice(-4)}
                </span>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
