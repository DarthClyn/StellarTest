import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './Navbar';
import Home from './pages/Home';
import Market from './pages/Market';
import Dashboard from './pages/Dashboard';

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route 
          path="/" 
          element={
            <PageWrapper>
              <Home />
            </PageWrapper>
          } 
        />
        <Route 
          path="/market" 
          element={
            <PageWrapper>
              <Market />
            </PageWrapper>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <PageWrapper>
              <Dashboard />
            </PageWrapper>
          } 
        />
      </Routes>
    </AnimatePresence>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

import { WalletProvider } from './context/WalletContext';

function App() {
  return (
    <Router>
      <WalletProvider>
        <div className="min-h-screen flex flex-col selection:bg-indigo-500/30">
          <Navbar />
          <main className="flex-grow">
            <AnimatedRoutes />
          </main>
        </div>
      </WalletProvider>
    </Router>
  );
}

export default App;
