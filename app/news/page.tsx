'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Bell,
  Calendar,
  Tag,
  ArrowRight,
  ExternalLink,
  Search,
  FileText,
  Mail,
  CheckCircle2,
} from 'lucide-react';

interface GazettePost {
  id: string;
  number: string;
  title: string;
  category: 'Executive Decree' | 'Territory & Engineering' | 'Diplomacy' | 'Regulatory';
  date: string;
  summary: string;
  content: string;
  signatory: string;
}

const POSTS: GazettePost[] = [
  {
    id: 'post-1',
    number: 'DEC-2026-09',
    title: 'Promulgation of the ICAO TD3 eMRTD Passport Standard',
    category: 'Regulatory',
    date: '2026-09-28',
    summary: 'The Ministry of Foreign Affairs & Justice officially adopts ICAO Doc 9303 Part 9 standards for machine-readable biometric passports in Covenant Burgundy.',
    content: 'Pursuant to Article 8 of the Covenant of Aletheia, the Ministry of Foreign Affairs has finalized the technical baseline for biometric passports. Featuring 80KB contactless microcontrollers, SAC/EAC access control, and laser-engraved polycarbonate data pages, document issuance begins in pilot phase with the founding cohort.',
    signatory: 'Chancellor & Minister of Foreign Affairs',
  },
  {
    id: 'post-2',
    number: 'DEC-2026-08',
    title: 'Groundbreaking on St. Brendan Autonomous Maritime Terminus',
    category: 'Territory & Engineering',
    date: '2026-09-14',
    summary: 'Engineering contracts awarded for Phase 1 construction of deepwater container logistics, offshore wave turbines, and automated border gates.',
    content: 'The Ministry of Territorial Development announces commencement of geotechnical maritime anchoring for the St. Brendan Port complex. Facilities include automated container crane networks, customs bonded warehouses, and renewable marine microgrids.',
    signatory: 'Minister of Territorial Development',
  },
  {
    id: 'post-3',
    number: 'DEC-2026-07',
    title: 'Establishment of the Public Cryptographic State Key Directory (PKD)',
    category: 'Executive Decree',
    date: '2026-08-30',
    summary: 'Master country signing root certificates distributed to international aviation and maritime border checkpoints.',
    content: 'Executive Order 2026-14 mandates public availability of the Country Signing CA (CSCA) root certificate to facilitate automated e-Gate border passage for Aletheian passport holders worldwide.',
    signatory: 'Chancellor of the Republic',
  },
  {
    id: 'post-4',
    number: 'DEC-2026-06',
    title: 'Bilateral Scientific & Maritime Environmental Accord with Antioch Institute',
    category: 'Diplomacy',
    date: '2026-08-12',
    summary: 'Partnership established to conduct high-resolution oceanic seabed mapping and sustainable North Sea ecology monitoring.',
    content: 'Aletheia enters into mutual environmental monitoring protocols to protect local pelagic ecosystems, deploying autonomous solar-powered surface vessels for continuous oceanographic telemetry.',
    signatory: 'Department of Maritime Affairs',
  },
];

export default function NewsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const filteredPosts = POSTS.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.number.toLowerCase().includes(search.toLowerCase()) ||
      p.summary.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO SECTION ── */}
      <section className="guilloche-hero relative text-parchment overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28 border-b border-gold/30">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-gold/40 bg-navy-deep/80 rounded-sm backdrop-blur-sm">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">Official Gazette</span>
              </div>
              <StatusBadge status="Operational" size="sm" />
            </div>

            <h1 className="heading-hero">
              Gazette & Public Dispatches
            </h1>

            <p className="text-base sm:text-lg text-parchment/72 leading-[1.85] font-light">
              Official executive decrees, regulatory determinations, state appointments, and engineering bulletins from The Sovereign Covenant State of Aletheia.
            </p>
          </div>
        </div>
      </section>

      {/* ── CONTROLS & SEARCH ── */}
      <section className="py-6 bg-white border-b border-navy/15 sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-navy/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search gazette bulletins..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['All', 'Executive Decree', 'Territory & Engineering', 'Diplomacy', 'Regulatory'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all ${
                    selectedCategory === cat
                      ? 'bg-navy text-gold'
                      : 'bg-parchment-light border border-navy/10 text-navy/70 hover:border-gold/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── GAZETTE BULLETINS FEED ── */}
      <section className="py-12 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="bg-white border border-navy/15 rounded-sm p-6 hover:shadow-md transition-shadow space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/10 pb-3">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-navy/5 text-navy font-mono text-[11px] font-bold rounded-sm border border-navy/10">
                    {post.number}
                  </span>
                  <span className="text-xs font-bold text-gold uppercase tracking-wider">
                    {post.category}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-navy/60 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{post.date}</span>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-navy leading-snug">{post.title}</h2>
                <p className="text-sm text-navy/70 mt-2 leading-relaxed">{post.summary}</p>
              </div>

              <div className="bg-parchment-light p-4 rounded-sm border border-navy/10 text-xs text-navy/80 leading-relaxed font-serif">
                {post.content}
              </div>

              <div className="flex items-center justify-between pt-2 text-xs text-navy/50">
                <span className="font-mono">Signatory: <strong className="text-navy">{post.signatory}</strong></span>
                <span className="text-[11px] font-mono text-laurel flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Promulgated & Inscribed on Ledger
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── GAZETTE SUBSCRIPTION BANNER ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <Bell className="w-8 h-8 text-gold mx-auto" />
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-parchment">Subscribe to the Official Gazette</h3>
            <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
              Receive official decrees, legislative acts, and territorial milestones directly via cryptographic digest or email.
            </p>
          </div>

          {!subscribed ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubscribed(true);
              }}
              className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                placeholder="Enter official email address..."
                className="flex-1 px-4 py-2.5 text-xs rounded-sm border border-navy/40 bg-navy-deep text-parchment focus:outline-none focus:border-gold"
              />
              <button
                type="submit"
                className="px-6 py-2.5 bg-gold text-navy text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-colors"
              >
                Subscribe
              </button>
            </form>
          ) : (
            <div className="p-4 bg-navy-deep border border-gold/40 rounded-sm text-xs text-gold max-w-md mx-auto">
              ✓ Subscribed. You will receive official notifications upon publication.
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
