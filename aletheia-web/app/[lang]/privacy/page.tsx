'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { Placeholder } from '@/components/ui/Placeholder';
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
            <>
              <p>{t("This platform is run by the founding team of Aletheia, a new-country project. Aletheia is not a recognised state; the data controller is the legal entity named below.")}</p>
              <p><Placeholder>data controller (legal entity, registered address) and privacy contact email</Placeholder></p>
            </>
          ),
        },
        {
          id: 'what-we-collect',
          heading: 'What we collect',
          body: (
            <>
              <p>{t("Browsing the public pages of this site requires no account and sets no tracking or advertising cookies. We collect only:")}</p>
              <ul>
                <li>{t("If you register interest as a Founding Member: your name, email address, country and, if you choose, a note on how you would like to contribute;")}</li>
                <li>{t("Minimal technical logs (IP address, time, page requested) retained for no more than 30 days for security purposes.")}</li>
              </ul>
            </>
          ),
        },
        {
          id: 'founding-members',
          heading: 'Founding Member registrations',
          body: (
            <p>{t("We use these details only to write to you about the founding of Aletheia. They are stored encrypted, are never published or written to a ledger, and are kept until you ask us to delete them. We do not collect identity documents or payment details.")}</p>
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
            <p>{t("Data is used only for the purpose for which you provided it, on the legal basis of your consent. It is never sold, never used for advertising and never shared with third parties except where the law requires it.")}</p>
          ),
        },
        {
          id: 'rights',
          heading: 'Your rights',
          body: (
            <ul>
              <li>{t("Access a copy of the data held about you;")}</li>
              <li>{t("Correct inaccurate data, and erase data that is no longer required;")}</li>
              <li>{t("Withdraw consent at any time, and object to or restrict processing;")}</li>
              <li>{t("Receive your data in a portable, machine-readable format;")}</li>
              <li>{t("Complain to the data protection authority in your country.")}</li>
            </ul>
          ),
        },
        {
          id: 'security',
          heading: 'Security',
          body: (
            <p>{t("Systems are protected using encryption in transit and at rest. Suspected vulnerabilities can be reported through")}{' '}
              <Link href="/adss/cybersecurity#disclosure">{t("coordinated disclosure")}</Link>.</p>
          ),
        },
      ]}
    />
  );
}
