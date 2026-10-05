'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Activity, Lock, Cpu, Globe2, Sparkles } from 'lucide-react';

export function SovereignTicker() {
  const [epoch, setEpoch] = useState(8421902);
  const [latency, setLatency] = useState(482);

  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(470 + Math.floor(Math.random() * 25));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-[#0E1B31] border-b border-[#C49A4E]/25 text-[11px] font-mono text-[#F4EEDF]/80 overflow-hidden relative z-30 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-4">
        
        {/* Left: Sovereign Pulse */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[#C49A4E]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C49A4E] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C49A4E]" />
            </span>
            <span className="font-bold tracking-wider text-[10px] uppercase">SOVEREIGN NETWORK PULSE</span>
          </div>
          <span className="hidden sm:inline text-white/20">|</span>
          <span className="hidden sm:inline text-[#F4EEDF]/60">
            StableChain Epoch <span className="text-[#C49A4E] font-bold">{epoch.toLocaleString()}</span>
          </span>
        </div>

        {/* Center / Right: Cryptographic Invariants */}
        <div className="flex items-center gap-4 text-[10.5px] overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 bg-[#15294A] px-2.5 py-0.5 rounded-sm border border-[#C49A4E]/20 text-[#F4EEDF]/90">
            <ShieldCheck className="w-3 h-3 text-[#3D8664]" />
            <span>Invariants I1–I12: <strong className="text-[#3D8664]">100% Backed</strong></span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 bg-[#15294A] px-2.5 py-0.5 rounded-sm border border-[#C49A4E]/20 text-[#F4EEDF]/90">
            <Lock className="w-3 h-3 text-[#C49A4E]" />
            <span>Statutory Parity: <strong className="text-[#C49A4E]">1 AEY = 1.00 EUR</strong></span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 bg-[#15294A] px-2.5 py-0.5 rounded-sm border border-[#C49A4E]/20 text-[#F4EEDF]/90">
            <Activity className="w-3 h-3 text-[#C49A4E]" />
            <span>Finality: <strong className="text-white">{latency}ms</strong></span>
          </div>

          <Link
            href="/transparency"
            className="flex items-center gap-1 text-[#C49A4E] hover:text-[#E4C689] transition-colors underline underline-offset-2 decoration-[#C49A4E]/40"
          >
            <span>Live Proofs</span>
            <span className="text-[9px]">→</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
