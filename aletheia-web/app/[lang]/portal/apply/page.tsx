'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState, useSyncExternalStore } from 'react';
import { INVESTMENT_OPTIONS, formatAey } from '@/lib/citizenship';
import { useToast } from '@/components/ui/Toast';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import { StarOfTruth } from '@/components/brand/Logo';
import { EXAMPLE } from '@/lib/stablechain';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  KeyRound,
  Sparkles,
} from 'lucide-react';

const noopSubscribe = () => () => {};

export default function ApplicationWizardPage() {
  const { t, tx, intl } = useI18n();
  const { notify } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nationality: 'DE',
    dob: '',
    passportNumber: '',
    purpose: 'business',
    intendedEntity: 'sarl',
    acceptedCovenant: false,
  });
  const [keyGenerated, setKeyGenerated] = useState(false);
  const [generatedKeyHash, setGeneratedKeyHash] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Which programme the applicant arrived for (?route=naturalisation|investor&option=...).
  const search = useSyncExternalStore(noopSubscribe, () => window.location.search, () => '');
  const params = new URLSearchParams(search);
  const routeParam = params.get('route');
  const route: 'e-residency' | 'naturalisation' | 'investor' =
    routeParam === 'naturalisation' || routeParam === 'investor' ? routeParam : 'e-residency';
  const investOption = route === 'investor' ? params.get('option') : null;
  // Investor applicants default to the investor purpose until they choose otherwise.
  const [purposeTouched, setPurposeTouched] = useState(false);
  const purpose = !purposeTouched && route === 'investor' ? 'investor' : formData.purpose;

  const investment = INVESTMENT_OPTIONS.find((o) => o.id === investOption) ?? INVESTMENT_OPTIONS[0];
  const routeTitle =
    route === 'investor' ? 'Citizenship — Covenant Investor route'
    : route === 'naturalisation' ? 'Citizenship — Naturalisation by residence'
    : 'Statutory e-residency & digital identity application under Sovereign Covenant State Charter';

  const handleNext = () => {
    if (currentStep === 3 && !keyGenerated) {
      // Simulate cryptographic key generation
      // An Ed25519 public key is 32 bytes, written as 64 lowercase hex characters (no 0x).
      const mockKey = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setGeneratedKeyHash(mockKey);
      setKeyGenerated(true);
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">

        {/* ── HEADER ── */}
        <div className="p-6 bg-navy text-parchment rounded-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 bg-navy-deep/80 rounded-sm mb-2">
                <StarOfTruth size={14} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gold">{t("Civic Application Gateway")}</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-parchment">{t("Application Wizard")}</h1>
              <p className="text-xs text-parchment/70 font-light">{tx(routeTitle)}</p>
              {tx(route === 'investor' && (
                <p className="mt-2 text-[11px] text-gold-tint">
                  {tx(investment.title)} · {formatAey(investment.amount, intl)}{' '}{t("· enhanced due diligence applies")}</p>
              ))}
            </div>

            <Link
              href="/portal"
              className="px-3.5 py-1.5 border border-gold/30 text-parchment font-semibold text-xs rounded-sm hover:border-gold transition-colors font-mono self-start sm:self-auto"
            >{t("← Back to Dashboard")}</Link>
          </div>

          {/* Stepper Progress Bar */}
          <div className="pt-2 max-w-xl">
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
              {[
                { num: 1, label: 'Identity' },
                { num: 2, label: 'Biometrics' },
                { num: 3, label: 'Purpose' },
                { num: 4, label: 'Submission' },
              ].map((s) => (
                <div key={s.num} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      currentStep >= s.num ? 'bg-gold' : 'bg-navy-deep'
                    }`}
                  />
                  <span
                    className={`text-[10px] uppercase block ${
                      currentStep >= s.num ? 'text-gold font-bold' : 'text-parchment/40'
                    }`}
                  >
                    {tx(s.num)}. {tx(s.label)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── WIZARD CONTAINER ── */}
        <div className="bg-white border border-navy/15 rounded-sm p-8 shadow-sm space-y-8 max-w-3xl mx-auto w-full">
          
          {tx(!submitted ? (
            <div>
              {/* STEP 1: IDENTITY */}
              {tx(currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-navy">{t("Step 1: Personal & Passport Information")}</h2>
                    <p className="text-xs text-navy/70 mt-1">{t("Enter details precisely as they appear on your government-issued ICAO travel document.")}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("First / Given Names")}</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder={t("e.g. Elizabeth")}
                        className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Last / Family Name")}</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder={t("e.g. Thorne-Vance")}
                        className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Nationality / Citizenship")}</label>
                      <select
                        value={formData.nationality}
                        onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy bg-white"
                      >
                        <option value="DE">{t("Germany (Bundesrepublik Deutschland)")}</option>
                        <option value="FR">{t("France (République Française)")}</option>
                        <option value="CH">{t("Switzerland (Schweiz / Suisse)")}</option>
                        <option value="GB">{t("United Kingdom (Great Britain)")}</option>
                        <option value="US">{t("United States of America")}</option>
                        <option value="IT">{t("Italy (Repubblica Italiana)")}</option>
                        <option value="RS">{t("Serbia (Republika Srbija)")}</option>
                        <option value="OTHER">{t("Other Sovereign State")}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("Date of Birth")}</label>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-navy uppercase tracking-wider block">{t("ICAO Passport Number")}</label>
                    <input
                      type="text"
                      value={formData.passportNumber}
                      onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                      placeholder="e.g. C38910482"
                      className="w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy font-mono"
                    />
                  </div>
                </div>
              ))}

              {/* STEP 2: BIOMETRIC VERIFICATION */}
              {tx(currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-navy">{t("Step 2: Document Verification & Photo Upload")}</h2>
                    <p className="text-xs text-navy/70 mt-1">{t("Upload high-resolution scans of your passport data page and a recent clear facial selfie.")}</p>
                  </div>

                  <div className="border-2 border-dashed border-navy/20 rounded-sm p-8 text-center space-y-3 hover:border-gold transition-colors cursor-pointer bg-parchment-light/50">
                    <Upload className="w-8 h-8 text-navy/40 mx-auto" />
                    <div>
                      <span className="text-xs font-bold text-navy block">{t("Drag & Drop Passport Data Page Photo")}</span>
                      <span className="text-[11px] text-navy/60">{t("JPEG, PNG or PDF (Max 10MB)")}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => notify('Document attached', 'passport_sample.jpg uploaded to your application (demonstration environment).')}
                      className="px-4 py-1.5 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors inline-block"
                    >{t("Select File")}</button>
                  </div>

                  <div className="p-4 bg-laurel/10 border border-laurel/30 rounded-sm flex items-start gap-2.5 text-xs text-laurel">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">{t("Encrypted Document Enclave")}</strong>
                      <span>{t("All uploaded documents are processed within memory-isolated hardware enclaves and deleted after identity inscription.")}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* STEP 3: PURPOSE & JURISDICTION */}
              {tx(currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-navy">{t("Step 3: Economic Purpose & Intended Activity")}</h2>
                    <p className="text-xs text-navy/70 mt-1">{t("Select your intended commercial activity in Aletheia.")}</p>
                  </div>

                  <div className="space-y-3 text-xs">
                    {[
                      { id: 'business', title: 'Corporate Enterprise / Company Founder', desc: 'Incorporate and operate an LLC / SARL or Joint Stock Corporation remotely.' },
                      { id: 'tech', title: 'Software Engineering & Scientific Research', desc: 'Contract with Aletheian research polytechnics and technology projects.' },
                      { id: 'investor', title: 'Sovereign Capital & Bond Investor', desc: 'Participate in sovereign development debt tranches and port concessions.' },
                      { id: 'nomad', title: 'Digital Freelancer & Remote Consultant', desc: 'Invoice international clients tax-neutrally using an Aletheian business entity.' },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`p-4 border rounded-sm flex items-start gap-3 cursor-pointer transition-colors block ${
                          purpose === opt.id
                            ? 'border-navy bg-navy/5 shadow-xs'
                            : 'border-navy/15 hover:border-navy/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="purpose"
                          value={opt.id}
                          checked={purpose === opt.id}
                          onChange={(e) => { setPurposeTouched(true); setFormData({ ...formData, purpose: e.target.value }); }}
                          className="mt-0.5"
                        />
                        <div>
                          <strong className="text-navy font-bold block">{tx(opt.title)}</strong>
                          <span className="text-navy/70">{tx(opt.desc)}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* STEP 4: CRYPTO KEYS & DECLARATION */}
              {tx(currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-navy">{t("Step 4: Cryptographic Key Inscription & Oath")}</h2>
                    <p className="text-xs text-navy/70 mt-1">{t("Your cryptographic public key has been generated locally in your browser.")}</p>
                  </div>

                  <div className="p-5 bg-navy text-parchment rounded-sm border border-gold/40 space-y-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-gold" />
                      <span className="text-xs font-bold text-parchment uppercase tracking-wider">{t("Generated ECDSA P-256 State Key Hash:")}</span>
                    </div>
                    <code className="text-xs font-mono text-gold block break-all bg-navy-deep p-3 rounded-sm border border-navy/40">
                      {generatedKeyHash || EXAMPLE.citizenPublicKey}
                    </code>
                    <p className="text-[11px] text-parchment/65">{t("This key pair will sign your e-residency credential and corporate filings on the StableChain ledger.")}</p>
                  </div>

                  <div className="p-4 bg-navy/5 border border-navy/15 rounded-sm space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer text-xs text-navy leading-relaxed">
                      <input
                        type="checkbox"
                        checked={formData.acceptedCovenant}
                        onChange={(e) => setFormData({ ...formData, acceptedCovenant: e.target.checked })}
                        className="mt-0.5"
                      />
                      <span>{t("I solemnly declare that all information submitted is accurate. I recognize the constitutional authority of the Covenant of Aletheia and understand that E-Residency is a digital legal identity that")}{' '}<strong>{t("conveys no right to physically reside or vote")}</strong>{' '}{t("in the Sovereign Covenant State.")}</span>
                    </label>
                  </div>
                </div>
              ))}

              {/* Controls */}
              <div className="pt-6 border-t border-navy/10 flex justify-between items-center">
                {tx(currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-5 py-2 border border-navy/20 text-navy text-xs font-semibold uppercase tracking-wider rounded-sm hover:border-navy transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />{' '}{t("Back")}</button>
                ) : (
                  <div />
                ))}

                {tx(currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2 bg-navy text-gold text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
                  >{t("Continue")}{' '}<ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!formData.acceptedCovenant}
                    onClick={handleSubmit}
                    className="px-6 py-2.5 bg-gold text-navy text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-gold-tint transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-gold/20"
                  >{t("Submit Application")}{' '}<Sparkles className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Submission Success State */
            <div className="text-center py-8 space-y-6">
              <div className="w-16 h-16 bg-laurel/10 rounded-full flex items-center justify-center mx-auto text-laurel">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-navy">{t("Application Submitted to the State Registry")}</h2>
                <p className="text-xs sm:text-sm text-navy/70 max-w-md mx-auto leading-relaxed">{t("Your e-residency application has been encrypted and assigned to the Ministry of Digital State queue.")}</p>
              </div>

              <div className="p-4 bg-navy-deep text-parchment rounded-sm max-w-md mx-auto font-mono text-xs space-y-1">
                <div className="text-gold font-bold">{t("Application Reference:")}</div>
                <div className="text-sm">{t("ALE-APP-2026-90412")}</div>
                <div className="text-[10px] text-parchment/50 pt-1">{t("Estimated Verification Time: 24 to 48 Hours")}</div>
              </div>

              <div className="pt-4 flex justify-center gap-4">
                <Link
                  href="/portal"
                  className="px-6 py-2.5 bg-navy text-gold font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors"
                >{t("Go to Civic Portal")}</Link>
                <Link
                  href="/"
                  className="px-6 py-2.5 border border-navy/20 text-navy font-semibold text-xs uppercase tracking-wider rounded-sm hover:border-navy transition-colors"
                >{t("Return Home")}</Link>
              </div>
            </div>
          ))}

        </div>
      </div>
    </PortalShell>
  );
}
