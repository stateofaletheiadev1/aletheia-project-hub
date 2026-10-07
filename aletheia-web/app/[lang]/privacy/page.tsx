'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { LegalDocument } from '@/components/ui/LegalDocument';

export default function PrivacyPage() {
  const { t } = useI18n();
  return (
    <LegalDocument
      eyebrow={t("Data Protection")}
      image="remoteWork"
      updated="5 October 2026"
      title={<>{t("Your data belongs")}{' '}<span className="text-gold-metallic">{t("to you.")}</span></>}
      lead={t("How this platform collects, protects and strictly limits the use of personal information — written to the standard of the EU General Data Protection Regulation.")}
      sections={[
        {
          id: 'controller',
          heading: 'Who is responsible',
          body: (
            <p>{t("The data controller for this platform is the Ministry of Digital State & Registries of the Sovereign Covenant State of Aletheia. Questions about this notice can be sent to")}{' '}<a href="mailto:chancery@aletheia.gov">{t("chancery@aletheia.gov")}</a>.
            </p>
          ),
        },
        {
          id: 'what-we-collect',
          heading: 'What we collect',
          body: (
            <>
              <p>{t("Browsing the public pages of this site requires no account and sets no tracking or advertising cookies. We collect only:")}</p>
              <ul>
                <li>{t("Information you choose to submit, such as an enquiry, a Gazette subscription or an application in the citizen portal;")}</li>
                <li>{t("Minimal technical logs (IP address, time, page requested) retained for no more than 30 days for security purposes.")}</li>
              </ul>
            </>
          ),
        },
        {
          id: 'ledger',
          heading: 'What never goes on the ledger',
          body: (
            <p>{t("Personal data, identity documents, biometrics and medical records are never written to StableChain. The ledger stores only cryptographic hashes and receipts that prove a record exists, or that consent was given, without revealing its content. This makes erasure possible: deleting the underlying record leaves an unreadable hash behind.")}</p>
          ),
        },
        {
          id: 'purpose',
          heading: 'How we use it',
          body: (
            <p>{t("Data is used only for the purpose for which you provided it, on the legal basis of your consent or the performance of a public task. It is never sold, never used for advertising and never shared with third parties except where a statute requires it — and every such disclosure is itself logged and auditable.")}</p>
          ),
        },
        {
          id: 'rights',
          heading: 'Your rights',
          body: (
            <ul>
              <li>{t("Access a copy of the data held about you, including the log of who has viewed it;")}</li>
              <li>{t("Correct inaccurate data, and erase data that is no longer required;")}</li>
              <li>{t("Withdraw consent at any time, and object to or restrict processing;")}</li>
              <li>{t("Receive your data in a portable, machine-readable format;")}</li>
              <li>{t("Complain to the independent Data Protection Commissioner.")}</li>
            </ul>
          ),
        },
        {
          id: 'security',
          heading: 'Security',
          body: (
            <p>{t("Systems are protected under the oversight of the")}{' '}
              <Link href="/adss/cybersecurity">{t("Aletheian Cybersecurity Department")}</Link>{t(", using encryption in transit and at rest, hardware-backed key storage and continuous monitoring. Suspected vulnerabilities can be reported through coordinated disclosure.")}</p>
          ),
        },
      ]}
    />
  );
}
