'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StarOfTruth } from '@/components/brand/Logo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ShieldCheck,
  Cpu,
  KeyRound,
  FileCheck2,
  Lock,
  Globe2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Search,
  AlertCircle,
  HelpCircle,
  QrCode,
  Fingerprint,
} from 'lucide-react';

export default function PassportPortalPage() {
  const [docId, setDocId] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'searching' | 'valid' | 'invalid'>('idle');

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId.trim()) return;
    setVerifyStatus('searching');
    setTimeout(() => {
      if (docId.trim().toUpperCase().startsWith('AL') || docId.trim().toUpperCase().startsWith('AEY')) {
        setVerifyStatus('valid');
      } else {
        setVerifyStatus('invalid');
      }
    }, 800);
  };

  return (
    <div className="flex flex-col min-h-screen bg-parchment-canvas">

      {/* ── HERO SECTION ── */}
      <section className="relative bg-navy text-parchment overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-32 border-b border-gold/20">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/95 via-navy/90 to-navy-deep" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/80 rounded-sm">
                  <StarOfTruth size={14} />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">ICAO Doc 9303 Compliant</span>
                </div>
                <StatusBadge status="Under Development" size="sm" />
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-parchment leading-[1.08]">
                Aletheian Biometric e-Passport
              </h1>

              <p className="text-base sm:text-lg text-parchment/75 leading-relaxed font-light max-w-2xl">
                The official Machine Readable Travel Document (TD3 eMRTD) of The Sovereign Covenant State of Aletheia. Engineered to European and ICAO standards with cryptographic biometric authentication, polycarbonate laser personalization, and ICAO Public Key Directory integration.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3 bg-navy-deep/60 border border-navy/30 rounded-sm">
                  <span className="text-[10px] font-mono uppercase text-gold block">Form Factor</span>
                  <span className="text-xs font-bold text-parchment">ISO/IEC 7810 ID-3</span>
                </div>
                <div className="p-3 bg-navy-deep/60 border border-navy/30 rounded-sm">
                  <span className="text-[10px] font-mono uppercase text-gold block">Data Page</span>
                  <span className="text-xs font-bold text-parchment">Laser Polycarbonate</span>
                </div>
                <div className="p-3 bg-navy-deep/60 border border-navy/30 rounded-sm">
                  <span className="text-[10px] font-mono uppercase text-gold block">Chip Security</span>
                  <span className="text-xs font-bold text-parchment">BAC / SAC + EAC</span>
                </div>
              </div>
            </div>

            {/* Passport Cover Visual */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-covenant-burgundy/40 to-gold/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
                <div className="relative">
                  <Image
                    src="/passport_cover.png"
                    alt="The Sovereign Covenant State of Aletheia Official Biometric Passport"
                    width={320}
                    height={447}
                    className="object-contain"
                    style={{ filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.6)) drop-shadow(0 8px 16px rgba(112,24,36,0.4))' }}
                    priority
                  />
                  <div className="mt-4 text-center">
                    <span className="inline-block px-3 py-1 bg-navy-deep/90 border border-gold/30 rounded-full text-[10px] font-mono text-gold tracking-widest uppercase">
                      Official Covenant Burgundy Cover Specimen
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECURITY LAYERS & ARCHITECTURE ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Physical & Cryptographic Integrity</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-navy tracking-tight">
            Multi-Tiered Biometric Security Architecture
          </h2>
          <p className="text-sm text-navy/70 leading-relaxed">
            The Aletheian e-Passport adheres to ICAO Doc 9303 Part 9 standards for contactless electronic machine readable travel documents, combining tactile physical security features with Elliptic Curve Cryptography.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Level 1: Overt Security Features */}
          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
              <EyeIcon className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy">Level 1: Overt Physical Inspection</h3>
            <ul className="space-y-2.5 text-xs text-navy/70 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Covenant Burgundy Book:</strong> Hot-stamped gold metallic foil with tactile debossed seal.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Laser-Engraved Polycarbonate:</strong> Tamper-evident fused substrate resistant to delamination.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Optically Variable Ink (OVI):</strong> Star of Truth emblem shifting from gold to emerald at tilt.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Tactile Guilloche:</strong> Multi-frequency high-precision background line engravings.</span>
              </li>
            </ul>
          </div>

          {/* Level 2: Machine Readable & Covert */}
          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy">Level 2: Automated Machine Reading</h3>
            <ul className="space-y-2.5 text-xs text-navy/70 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>ICAO TD3 MRZ:</strong> 2 lines of 44 characters (OCR-B font) specifying nationality code <code>ALE</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Ultraviolet Fluorescent Ink:</strong> Dual-band (365nm / 254nm) maritime caravel security watermarks.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Micro-text Printing:</strong> Latin text of Article 1 of the Covenant embedded in borders.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Ghost Secondary Portrait:</strong> Perforated secondary photo verified under transmitted backlight.</span>
              </li>
            </ul>
          </div>

          {/* Level 3: Cryptographic Contactless Chip */}
          <div className="bg-white border border-navy/15 rounded-sm p-6 space-y-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-sm bg-navy text-gold flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy">Level 3: Cryptographic Chip</h3>
            <ul className="space-y-2.5 text-xs text-navy/70 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Contactless IC:</strong> ISO/IEC 14443 Type A/B microcontroller with 80KB secure memory.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>LDS 1.7 Data Groups:</strong> DG1 (MRZ), DG2 (Facial Biometrics), DG3 (Fingerprint minutiae).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>Passive & Active Auth:</strong> ECDSA / SHA-384 cryptographic signatures prevents cloning.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-laurel shrink-0 mt-0.5" />
                <span><strong>ICAO PKD Root:</strong> Country Signing CA (CSCA) root certificate distributed for automated e-Gate entry.</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* ── TECHNICAL SPECIFICATION TABLE ── */}
      <section className="py-16 bg-parchment-light border-y border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-8 space-y-2">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Official Standards</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">
              Statutory Document Specifications
            </h2>
            <p className="text-xs sm:text-sm text-navy/70">
              Pursuant to the Passports & Diplomatic Documents Act, promulgated by the Ministry of Foreign Affairs & Justice.
            </p>
          </div>

          <div className="bg-white border border-navy/15 rounded-sm overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-navy text-parchment font-mono uppercase tracking-wider text-[11px] border-b border-navy/20">
                    <th className="p-4">Technical Parameter</th>
                    <th className="p-4">Statutory Specification</th>
                    <th className="p-4">International Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/10">
                  <tr className="hover:bg-parchment-light/60">
                    <td className="p-4 font-semibold text-navy">Document Designation</td>
                    <td className="p-4 text-navy/80">Ordinary Biometric Passport (Type P)</td>
                    <td className="p-4 font-mono text-navy/60">ICAO Doc 9303 Part 4</td>
                  </tr>
                  <tr className="hover:bg-parchment-light/60">
                    <td className="p-4 font-semibold text-navy">Issuing State Code</td>
                    <td className="p-4 font-mono font-bold text-navy">ALE</td>
                    <td className="p-4 font-mono text-navy/60">ISO 3166-1 alpha-3</td>
                  </tr>
                  <tr className="hover:bg-parchment-light/60">
                    <td className="p-4 font-semibold text-navy">Dimensions</td>
                    <td className="p-4 text-navy/80">88.0 mm × 125.0 mm (32 or 48 pages)</td>
                    <td className="p-4 font-mono text-navy/60">ISO/IEC 7810 ID-3</td>
                  </tr>
                  <tr className="hover:bg-parchment-light/60">
                    <td className="p-4 font-semibold text-navy">Cover Material & Color</td>
                    <td className="p-4 text-navy/80">Covenant Burgundy (Hex #701824) with gold foil embossing</td>
                    <td className="p-4 font-mono text-navy/60">National Brand Guidelines v1.4</td>
                  </tr>
                  <tr className="hover:bg-parchment-light/60">
                    <td className="p-4 font-semibold text-navy">Data Page Material</td>
                    <td className="p-4 text-navy/80">100% Solid Polycarbonate with laser engraving</td>
                    <td className="p-4 font-mono text-navy/60">Doc 9303 Part 3</td>
                  </tr>
                  <tr className="hover:bg-parchment-light/60">
                    <td className="p-4 font-semibold text-navy">Cryptographic Standard</td>
                    <td className="p-4 text-navy/80">BSI TR-03110 EAC v2 (PACE + Chip Authentication)</td>
                    <td className="p-4 font-mono text-navy/60">EU Regulation 2252/2004 Standard</td>
                  </tr>
                  <tr className="hover:bg-parchment-light/60">
                    <td className="p-4 font-semibold text-navy">Validity Period</td>
                    <td className="p-4 text-navy/80">10 Years (Adults aged 18+) / 5 Years (Minors)</td>
                    <td className="p-4 font-mono text-navy/60">Passports Act § 4</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── PUBLIC DIRECTORY & DOCUMENT STATUS CHECKER ── */}
      <section className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold tracking-eyebrow uppercase text-gold">Public Verification Registry</span>
            <h2 className="text-3xl font-bold text-navy tracking-tight">
              Real-Time Document Verification Portal
            </h2>
            <p className="text-sm text-navy/70 leading-relaxed">
              Immigration authorities, airlines, and border control personnel may verify the issuance status and cryptographic revocation state of Aletheian travel credentials against the national identity public registry.
            </p>

            <form onSubmit={handleVerify} className="space-y-4 bg-white p-6 border border-navy/15 rounded-sm shadow-sm">
              <label htmlFor="doc-input" className="block text-xs font-bold text-navy uppercase tracking-wider">
                Enter Document Number or Public Hash:
              </label>
              <div className="flex gap-2">
                <input
                  id="doc-input"
                  type="text"
                  placeholder="e.g. ALE-0049281 or AEY-DOC"
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy font-mono"
                />
                <button
                  type="submit"
                  disabled={verifyStatus === 'searching'}
                  className="px-5 py-2.5 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  {verifyStatus === 'searching' ? 'Verifying...' : 'Verify'}
                </button>
              </div>

              {verifyStatus === 'valid' && (
                <div className="p-3.5 bg-laurel/10 border border-laurel/30 rounded-sm flex items-start gap-2.5 text-xs text-laurel">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Document Cryptographically Valid</span>
                    <span className="text-[11px] opacity-80">Registered under National CSCA Root. Status: Active & Operational.</span>
                  </div>
                </div>
              )}

              {verifyStatus === 'invalid' && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-sm flex items-start gap-2.5 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Specimen or Unregistered Record</span>
                    <span className="text-[11px] opacity-80">No active document issuance found for this identifier. Check syntax or contact Registry.</span>
                  </div>
                </div>
              )}
            </form>
          </div>

          <div className="lg:col-span-6 bg-navy text-parchment p-8 rounded-sm border border-gold/30 space-y-6">
            <div className="flex items-center gap-3">
              <KeyRound className="w-6 h-6 text-gold" />
              <h3 className="text-lg font-bold text-parchment">PKD & CSCA Certificate Download</h3>
            </div>
            <p className="text-xs text-parchment/70 leading-relaxed">
              Foreign border administration departments may download the latest Aletheian Country Signing CA (CSCA) root certificate and Master List for import into automated e-Gate border infrastructure.
            </p>
            <div className="space-y-3 font-mono text-[11px] bg-navy-deep p-4 rounded-sm border border-navy/40">
              <div className="flex justify-between border-b border-navy/40 pb-2">
                <span className="text-gold">CSCA SHA-256 Fingerprint:</span>
                <span className="text-parchment/80">9A:4F:2E:88:C1:92:30:FE...</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gold">CRL Distribution Point:</span>
                <span className="text-parchment/80">https://pki.aletheia.gov/crl</span>
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                onClick={() => alert('CSCA Root certificate (DER format) download initiated.')}
                className="px-4 py-2 bg-gold text-navy text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-colors"
              >
                Download CSCA Root (.cer)
              </button>
              <Link
                href="/government"
                className="px-4 py-2 border border-gold/30 text-parchment text-xs font-semibold uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
              >
                Diplomatic Inquiries
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="bg-navy text-parchment py-16 border-t border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <StarOfTruth size={36} className="mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-parchment">
            Passport Issuance Eligibility
          </h2>
          <p className="text-xs sm:text-sm text-parchment/70 max-w-xl mx-auto leading-relaxed">
            Aletheian biometric passports are issued exclusively to confirmed sovereign citizens under Article 8 of the Covenant. E-residency does not confer a passport.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/citizenship"
              className="px-6 py-2.5 bg-gold text-navy font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all"
            >
              Citizenship Pathways
            </Link>
            <Link
              href="/e-residency"
              className="px-6 py-2.5 border border-gold/30 text-parchment font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-gold/60 transition-colors"
            >
              Explore E-Residency
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
