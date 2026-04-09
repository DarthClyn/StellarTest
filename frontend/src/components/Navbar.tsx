// src/components/Navbar.tsx
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Agent Bazar</Link>
        <Link href="/market" className="text-zinc-700 dark:text-zinc-200 hover:underline">Market</Link>
        <Link href="/dashboard" className="text-zinc-700 dark:text-zinc-200 hover:underline">Dashboard</Link>
      </div>
      <button className="ml-auto bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition">Connect Freighter</button>
    </nav>
  );
}
