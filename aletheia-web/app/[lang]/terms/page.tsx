'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { LegalDocument } from '@/components/ui/LegalDocument';

export default function TermsPage() {
  const { t } = useI18n();
  return (
    <LegalDocument
      eyebrow={t("Terms of Use")}
      image="lawLibrary"
      updated="5 October 2026"
      title={<>{t("Terms of use of the")}{' '}<span className="text-gold-metallic">{t("founding-phase platform.")}</span></>}
      lead={t("The conditions under which this founding-phase platform may be used, and the limits of what it represents.")}
      sections={[
        {
          id: 'status',
          heading: 'Status of information',
          body: (
            <p>{t("Aletheia is a new-country project in its founding phase. It is not a recognised state, holds no territory, exercises no legal authority, and issues no passports, legal currency or citizenship. Every institution, service and asset on this platform carries a status; only items marked Operational are functioning today. See")}{' '}<Link href="/transparency">{t("Status & Disclaimers")}</Link>.
            </p>
          ),
        },
        {
          id: 'no-offer',
          heading: 'No offer of any kind',
          body: (
            <p>{t("Nothing on this platform is an offer to sell securities, bonds, tokens, currency or any other financial instrument, and Aletheia accepts no investment through it. Aletheia does not sell citizenship, residency or passports. AEY is not currently issued to the public and is not legal tender or e-money.")}</p>
          ),
        },
        {
          id: 'authoritative',
          heading: 'Authoritative texts',
          body: (
            <p>{t("The draft Covenant, proposed Acts and Gazette records are founding-phase documents without legal force. Translations are provided for convenience; the English text is authoritative.")}</p>
          ),
        },
        {
          id: 'acceptable-use',
          heading: 'Acceptable use',
          body: (
            <ul>
              <li>{t("Do not attempt to access private areas of the platform without authorisation;")}</li>
              <li>{t("Do not probe, scan or test the security of the platform except through coordinated disclosure;")}</li>
              <li>{t("Do not use the arms, flag or name of Aletheia to imply endorsement, or to offer anything in Aletheia’s name.")}</li>
            </ul>
          ),
        },
        {
          id: 'reuse',
          heading: 'Re-use of public information',
          body: (
            <p>{t("Founding documents, Gazette records and published datasets may be freely re-used with attribution. The coat of arms, flags and heraldic devices are protected designs and may not be reproduced commercially.")}</p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to these terms',
          body: <p>{t("These terms may be amended. Material changes are announced in the")}{' '}<Link href="/news">{t("Gazette")}</Link>.</p>,
        },
      ]}
    />
  );
}
