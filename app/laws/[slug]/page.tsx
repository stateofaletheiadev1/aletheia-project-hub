'use client';

import React from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Scale,
  BookOpen,
  Calendar,
  Hash,
  Download,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Printer,
  ShieldCheck,
} from 'lucide-react';

interface StatuteDetail {
  slug: string;
  code: string;
  title: string;
  article: string;
  date: string;
  hash: string;
  preamble: string;
  sections: {
    number: string;
    heading: string;
    text: string;
  }[];
  signatory: string;
}

const STATUTE_DATABASE: Record<string, StatuteDetail> = {
  'constitutional-supremacy': {
    slug: 'constitutional-supremacy',
    code: 'ACT-2026-01',
    title: 'Constitutional Supremacy & Judicial Review Act',
    article: 'Constitution Article 1 § 3',
    date: '2026-01-20',
    hash: '0x8f2b7a4c91e3d085fa49b817e4521098ef7321ac90b34d76a218fce1b2049e91',
    preamble: 'An Act to solemnly affirm the inviolable supremacy of the Covenant of Aletheia as the highest law of the land, establishing the High Court of Justice as the sole arbiter of constitutional conformity and voiding all conflicting executive determinations.',
    sections: [
      { number: 'Section 1', heading: 'Supremacy Invariant', text: 'No statute, treaty, administrative decree, or municipal regulation shall have legal force or effect to the extent that it conflicts with any provision of the Covenant of Aletheia.' },
      { number: 'Section 2', heading: 'Exclusive Judicial Review', text: 'The High Court of Justice possesses exclusive original and appellate jurisdiction to hear constitutional challenges brought by any citizen, resident, or parliamentary minority.' },
      { number: 'Section 3', heading: 'Automatic Invalidation', text: 'Any legislative enactment or executive decree declared unconstitutional by a majority of the High Court is void ab initio.' },
    ],
    signatory: 'Chancellor & President of the High Court',
  },
  'languages-act': {
    slug: 'languages-act',
    code: 'ACT-2026-02',
    title: 'Official Languages & Diplomatic Communication Act',
    article: 'Constitution Article 2 § 2',
    date: '2026-01-28',
    hash: '0x14ea892018fa34091ec87201948ba209ef731204891230fca890214890ecb820',
    preamble: 'An Act providing for the official language regime of the Republic, ensuring equal dignity for European languages and seamless global diplomatic representation.',
    sections: [
      { number: 'Section 1', heading: 'Official Languages', text: 'The official languages of The Sovereign Covenant State of Aletheia are English, German, Serbian, and Italian. English shall serve as the primary procedural language for international commercial contracts.' },
      { number: 'Section 2', heading: 'Bilingual & Multilingual State Documents', text: 'All primary constitutional texts, biometric passport inscriptions, and legal codes shall be published concurrently in the four official languages.' },
      { number: 'Section 3', heading: 'Judicial Proceedings', text: 'Parties to any civil, commercial, or criminal proceeding possess the statutory right to sworn simultaneous translation without fee.' },
    ],
    signatory: 'Minister of Foreign Affairs & Justice',
  },
  'maritime-zones': {
    slug: 'maritime-zones',
    code: 'ACT-2026-03',
    title: 'Maritime Zones & UNCLOS Jurisdiction Act',
    article: 'Constitution Article 3 § 4',
    date: '2026-02-05',
    hash: '0x77ba90123ca87201948ea20914be872190847b2c01948fe2198034a890123ca7',
    preamble: 'An Act defining the maritime territorial limits, contiguous zone, and Exclusive Economic Zone of Aletheia in strict compliance with the United Nations Convention on the Law of the Sea.',
    sections: [
      { number: 'Section 1', heading: 'Territorial Sea Limit', text: 'The sovereignty of Aletheia extends to a territorial sea baseline of 12 nautical miles, encompassing all civil platforms, breakwaters, and natural baselines.' },
      { number: 'Section 2', heading: 'Exclusive Economic Zone', text: 'The republic claims an Exclusive Economic Zone (EEZ) extending up to 200 nautical miles for the purpose of exploring, conserving, and managing marine pelagic resources, wave energy generation, and offshore wind.' },
      { number: 'Section 3', heading: 'Right of Innocent Passage', text: 'Foreign civilian and merchant vessels enjoy the right of innocent passage through territorial waters pursuant to international maritime conventions.' },
    ],
    signatory: 'Minister of Territorial Development & ADSS Maritime Admiral',
  },
  'nationality-act': {
    slug: 'nationality-act',
    code: 'ACT-2026-04',
    title: 'Nationality & Naturalisation Act',
    article: 'Constitution Article 8 § 5',
    date: '2026-02-14',
    hash: '0x3c9902ba14ff28e67a01d5e390c88461ab209ef731478201fa8892ca3401ef62',
    preamble: 'An Act setting forth the rights, duties, and acquisition criteria for Aletheian citizenship, defining naturalisation by physical residence and covenant awards.',
    sections: [
      { number: 'Section 1', heading: 'Citizenship by Covenant', text: 'Citizenship is a voluntary civic covenant. No person shall be compelled into citizenship, nor stripped of nationality for political expression.' },
      { number: 'Section 2', heading: 'Naturalisation Requirements', text: 'Lawful permanent residents who have resided physically in Aletheian territory for three continuous years and demonstrated knowledge of the Covenant are entitled to apply for full naturalisation.' },
      { number: 'Section 3', heading: 'Biometric Passport Right', text: 'Every confirmed citizen possesses an inalienable statutory right to an ICAO Doc 9303 compliant biometric passport issued in Covenant Burgundy.' },
    ],
    signatory: 'Chancellor of the Republic & Registrar General',
  },
  'e-residency-act': {
    slug: 'e-residency-act',
    code: 'ACT-2026-05',
    title: 'Digital E-Residency & Virtual Jurisdiction Act',
    article: 'Constitution Article 9 § 4',
    date: '2026-02-22',
    hash: '0x55902148ea20914801fa8892ca3401ef6291a0123ca78091ecb87201948ba209e',
    preamble: 'An Act establishing the digital identity framework of the Republic, empowering international entrepreneurs to form companies, execute contracts, and utilize state settlement rails.',
    sections: [
      { number: 'Section 1', heading: 'Digital Identity Inscription', text: 'E-Residency is a cryptographic digital identity conferring legal capacity to sign contracts and form commercial entities under Aletheian jurisdiction.' },
      { number: 'Section 2', heading: 'Physical Rights Exclusion', text: 'E-Residency expressly conveys no right to enter, physically reside, work as an employee, or claim citizenship or travel documents of the republic.' },
      { number: 'Section 3', heading: 'Tax Neutrality', text: 'E-residents operating foreign-sourced digital businesses through an Aletheian corporate vehicle are subject to zero personal income tax in Aletheia.' },
    ],
    signatory: 'Minister of Digital State & Registrar of Companies',
  },
  'monetary-act': {
    slug: 'monetary-act',
    code: 'ACT-2026-06',
    title: 'Monetary Architecture & Reserve Backing Act',
    article: 'Constitution Article 14 § 6',
    date: '2026-03-04',
    hash: '0xaa18902ef34b890123ca78091ecb87201948ba209ef182049ec8720914be8721',
    preamble: 'An Act establishing the Aletheian Guilder (AEY) as the sole legal tender, guaranteeing 100% reserve backing and prohibiting inflationary monetization.',
    sections: [
      { number: 'Section 1', heading: 'Legal Tender & Unit of Account', text: 'The Aletheian Guilder (AEY) is the statutory currency of the republic, maintained at a fixed 1:1 parity with the European Euro.' },
      { number: 'Section 2', heading: 'The 100% Reserve Floor', text: 'The Central Bank is prohibited from issuing AEY without matching segregated reserves of physical gold (London Good Delivery), tier-1 European debt, or liquid SDR claims.' },
      { number: 'Section 3', heading: 'Par Redemption', text: 'Holders of AEY may demand unconditional redemption in physical Euros or gold at statutory parity without discount or fee.' },
    ],
    signatory: 'Governor of the Central Bank & Minister of Treasury',
  },
  'executive-act': {
    slug: 'executive-act',
    code: 'ACT-2026-07',
    title: 'Executive Cabinet & Ministerial Portfolios Act',
    article: 'Constitution Article 15 § 5',
    date: '2026-03-12',
    hash: '0x9920184fa9802ecb87201948ba340291ef732014890ecb8201948ea20914801fa',
    preamble: 'An Act governing the structure, powers, and constitutional limits of the executive government, enforcing the statutory maximum of nine ministries.',
    sections: [
      { number: 'Section 1', heading: 'Cabinet Cap', text: 'The executive Cabinet shall consist of the Chancellor and not more than eight ministers of state. No additional ministry may be created without constitutional amendment.' },
      { number: 'Section 2', heading: 'Parliamentary Confirmation', text: 'All ministerial nominees must be examined and confirmed by a majority vote of the Covenant Assembly.' },
      { number: 'Section 3', heading: 'Statutory Transparency', text: 'All executive orders and ministerial determinations must be signed with official cryptographic keys and published in the Official Gazette within 24 hours of enactment.' },
    ],
    signatory: 'Chancellor of the Republic & Speaker of the Covenant Assembly',
  },
  'adss-act': {
    slug: 'adss-act',
    code: 'ACT-2026-08',
    title: 'Armed & Defensive Sovereign Service (ADSS) Governance Act',
    article: 'Constitution Article 18 § 4',
    date: '2026-03-20',
    hash: '0x4489021fa89023ebc87201948ea20914bca890214890ec8201948ea20914801e',
    preamble: 'An Act regulating the armed defence forces, civilian police, and coast guard services, enforcing strict civilian control and prohibiting internal domestic military policing.',
    sections: [
      { number: 'Section 1', heading: 'Civilian Subordination', text: 'The Armed & Defensive Sovereign Service is subordinated to civilian authority. The civilian Minister of Security exercises executive direction over all operational commands.' },
      { number: 'Section 2', heading: 'Prohibition of Domestic Military Policing', text: 'Military personnel and defense hardware shall never be deployed for domestic civilian crowd control or routine law enforcement.' },
      { number: 'Section 3', heading: 'Maritime Search & Rescue Mandate', text: 'The Coast Guard Directorate is statutorily bound to render immediate maritime humanitarian assistance to any vessel in distress regardless of flag or nationality.' },
    ],
    signatory: 'Minister of Security & Civil Defence',
  },
  'cyber-resilience': {
    slug: 'cyber-resilience',
    code: 'ACT-2026-09',
    title: 'Critical National Infrastructure & Cyber Resilience Act',
    article: 'Constitution Article 19 § 3',
    date: '2026-03-29',
    hash: '0x66189023ebca87201948ea20914801e991204890ecb8201948ea20914801fa88',
    preamble: 'An Act providing for the mandatory cyber hardening, post-quantum cryptographic standards, and optical air-gapping of sovereign ledgers and public utility grids.',
    sections: [
      { number: 'Section 1', heading: 'Validator Consensus Security', text: 'All state consensus validator nodes must be hosted on sovereign hardware with FIPS 140-3 Level 4 HSM key storage and multi-carrier BGP protection.' },
      { number: 'Section 2', heading: 'SCADA Optical Isolation', text: 'Industrial control systems governing offshore wind arrays, port handling gantries, and water desalination must be physically isolated from the public internet via unidirectional optical data diodes.' },
      { number: 'Section 3', heading: 'Mandatory Incident Reporting', text: 'Critical infrastructure operators must report all cyber intrusion attempts to the CSIRT-ALE national desk within sixty minutes of detection.' },
    ],
    signatory: 'Director of the National Cybersecurity Directorate',
  },
};

export default function StatuteDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const statute = STATUTE_DATABASE[slug];

  if (!statute) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HEADER ── */}
      <section className="bg-navy text-parchment pt-24 pb-16 border-b border-gold/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <Link
            href="/laws"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Codified Statutes Index
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2 py-0.5 bg-navy-deep text-parchment font-mono text-[10px] font-bold rounded-sm border border-navy/40">
              {statute.code}
            </span>
            <span className="text-xs font-mono text-gold font-bold">{statute.article}</span>
            <StatusBadge status="Operational" size="sm" />
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-parchment leading-tight">
            {statute.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-parchment/60 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gold" /> Enacted: {statute.date}
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-gold" /> Ledger Hash: {statute.hash.slice(0, 18)}...
            </span>
          </div>
        </div>
      </section>

      {/* ── STATUTE BODY ── */}
      <section className="py-12 lg:py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-white border border-navy/15 rounded-sm p-8 sm:p-12 shadow-sm space-y-8">
          
          {/* Action Bar */}
          <div className="flex justify-between items-center border-b border-navy/10 pb-4 text-xs">
            <span className="font-mono text-navy/60">Official Gazette Statutory Inscription</span>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 border border-navy/20 text-navy font-semibold rounded-sm hover:border-gold hover:text-gold transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                onClick={() => alert(`Official PDF for ${statute.code} generated with sovereign cryptographic signature.`)}
                className="px-3 py-1.5 bg-navy text-gold font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download Official PDF
              </button>
            </div>
          </div>

          {/* Preamble */}
          <div className="p-6 bg-parchment-light border-l-4 border-gold rounded-sm space-y-2">
            <span className="text-[10px] font-mono text-gold uppercase tracking-wider font-bold block">
              Preamble & Legislative Intent:
            </span>
            <p className="text-xs sm:text-sm text-navy/80 font-serif italic leading-relaxed">
              &ldquo;{statute.preamble}&rdquo;
            </p>
          </div>

          {/* Enacted Articles */}
          <div className="space-y-6 pt-4">
            {statute.sections.map((sec, idx) => (
              <div key={idx} className="space-y-2 border-b border-navy/5 pb-6 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-navy/5 text-navy font-mono text-[10px] font-bold rounded-sm">
                    {sec.number}
                  </span>
                  <h3 className="text-base font-bold text-navy">{sec.heading}</h3>
                </div>
                <p className="text-xs sm:text-sm text-navy/80 leading-relaxed pl-1 font-serif">
                  {sec.text}
                </p>
              </div>
            ))}
          </div>

          {/* Promulgation & Signatory Seal Block */}
          <div className="pt-8 border-t-2 border-navy/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1 text-xs">
              <span className="font-mono text-gold font-bold block">Enacting Promulgation Authority:</span>
              <p className="font-bold text-navy">{statute.signatory}</p>
              <span className="text-[11px] font-mono text-navy/50">Covenant Assembly Gazette Publication No. {statute.code}</span>
            </div>

            <div className="p-3 bg-navy text-parchment rounded-sm border border-gold/30 text-center font-mono text-[10px] space-y-1">
              <div className="text-gold font-bold flex items-center gap-1 justify-center">
                <ShieldCheck className="w-3 h-3" /> Promulgated & Inscribed
              </div>
              <div className="text-parchment/60">Verified on StableChain #0</div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
