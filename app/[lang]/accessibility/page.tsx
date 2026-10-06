'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { LegalDocument } from '@/components/ui/LegalDocument';

export default function AccessibilityPage() {
  const { t } = useI18n();
  return (
    <LegalDocument
      eyebrow={t("Accessibility Statement")}
      image="tabletWork"
      updated="5 October 2026"
      title={<>{t("A digital state that works")}{' '}<span className="text-gold-metallic">{t("for everyone.")}</span></>}
      lead={t("Public services must be usable by every member of the public. This statement sets out the standard we hold ourselves to and where we still fall short.")}
      sections={[
        {
          id: 'standard',
          heading: 'Our standard',
          body: <p>{t("This platform aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, and to EN 301 549.")}</p>,
        },
        {
          id: 'what-we-do',
          heading: 'What we have done',
          body: (
            <ul>
              <li>{t("A skip link to the main content on every page, and a logical heading order;")}</li>
              <li>{t("Full keyboard navigation of menus, filters and accordions, with visible focus states;")}</li>
              <li>{t("Text alternatives for informative images; decorative photography is hidden from screen readers;")}</li>
              <li>{t("All animation is disabled automatically when your device requests reduced motion;")}</li>
              <li>{t("Notifications are announced to assistive technology through polite live regions.")}</li>
            </ul>
          ),
        },
        {
          id: 'limitations',
          heading: 'Known limitations',
          body: (
            <ul>
              <li>{t("Some data-dense tables in the officer and portal areas are not yet optimised for small screens;")}</li>
              <li>{t("Official PDF editions are not yet tagged for screen readers; the HTML page for every statute and document is the accessible version;")}</li>
              <li>{t("Officer administration screens are published in English only, the working language of state administration; all public pages are available in the five official languages.")}</li>
            </ul>
          ),
        },
        {
          id: 'feedback',
          heading: 'Feedback and alternative formats',
          body: (
            <p>{t("If you find a barrier, or need information in another format such as large print, easy-read or audio, please")}{' '}
              <Link href="/contact">{t("contact the public registry")}</Link>{t(". We aim to respond within five working days.")}</p>
          ),
        },
      ]}
    />
  );
}
