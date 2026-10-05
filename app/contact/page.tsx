'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Mail,
  MapPin,
  Phone,
  Globe2,
  ShieldCheck,
  Send,
  Building,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [department, setDepartment] = useState('general');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO ── */}
      <section className="relative bg-navy text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/20">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/95 via-navy/90 to-navy-deep" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/80 rounded-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Chancery of State</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-parchment leading-[1.08]">
              Diplomatic Missions & Public Contact
            </h1>

            <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light">
              Official channels of communication for foreign governments, international organizations, corporate enterprises, prospective e-residents, and accredited press correspondents.
            </p>
          </div>
        </div>
      </section>

      {/* ── MISSIONS & OFFICES ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left: Contact Form */}
          <div className="lg:col-span-7 bg-white p-8 border border-navy/15 rounded-sm shadow-sm space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-navy">Submit an Official Inquiry</h2>
              <p className="text-xs text-navy/70 mt-1">
                All communications sent via this portal are cryptographically hashed and directed to the appropriate ministerial portfolio.
              </p>
            </div>

            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                      Full Name / Official Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Hélène de Vance"
                      className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                      Official Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@organization.org"
                      className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                    Target Department / Portfolio
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy bg-white"
                  >
                    <option value="general">General Secretariat of State</option>
                    <option value="foreign">Ministry of Foreign Affairs & Treaties</option>
                    <option value="eresidency">E-Residency & Digital State Registry</option>
                    <option value="immigration">ADSS Immigration & Border Directorate</option>
                    <option value="treasury">Treasury & Sovereign Investment</option>
                    <option value="press">Government Press Office</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">
                    Message / Diplomatic Note
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Enter inquiry details, references, or treaty dispatch..."
                    className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" /> Transmit Inquiry
                </button>
              </form>
            ) : (
              <div className="p-6 bg-laurel/10 border border-laurel/30 rounded-sm space-y-2 text-xs text-laurel">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Inquiry Registered on State Dispatch Registry
                </div>
                <p className="text-navy/70 leading-relaxed">
                  Thank you. Your message has been received with cryptographic timestamp. A response will be transmitted to your verified email within statutory response deadlines (typically 48 hours for diplomatic matters).
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-xs text-navy font-bold hover:underline pt-2 block"
                >
                  Submit another inquiry
                </button>
              </div>
            )}
          </div>

          {/* Right: Diplomatic Missions Directory */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-navy text-parchment p-6 rounded-sm border border-gold/30 space-y-4">
              <span className="text-[10px] font-mono uppercase text-gold">Principal Seat</span>
              <h3 className="text-lg font-bold text-parchment">Federal Chancery & State Secretariat</h3>
              <div className="space-y-2 text-xs text-parchment/75">
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                  <span>The Hexagonal Citadel, Antioch Federal District, The Sovereign Covenant State of Aletheia</span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gold shrink-0" />
                  <span>chancery@aletheia.gov</span>
                </p>
                <p className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-gold shrink-0" />
                  <span className="font-mono text-[10px]">PGP: 4A89 12FE 009B CF21 8891</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-sm border border-navy/15 space-y-4 shadow-xs">
              <span className="text-[10px] font-mono uppercase text-gold font-bold">Consular & Trade Liaison</span>
              <div className="space-y-4 text-xs divide-y divide-navy/10">
                <div className="pt-2 first:pt-0 space-y-1">
                  <h4 className="font-bold text-navy">European Maritime Liaison Mission</h4>
                  <p className="text-navy/70">Avenue Louise 240, 1050 Brussels, Kingdom of Belgium</p>
                  <p className="font-mono text-[11px] text-navy/50">brussels.mission@aletheia.gov</p>
                </div>

                <div className="pt-3 space-y-1">
                  <h4 className="font-bold text-navy">International Treaty & Arbitration Bureau</h4>
                  <p className="text-navy/70">Rue de Varembé 1, 1202 Geneva, Swiss Confederation</p>
                  <p className="font-mono text-[11px] text-navy/50">geneva.registry@aletheia.gov</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
