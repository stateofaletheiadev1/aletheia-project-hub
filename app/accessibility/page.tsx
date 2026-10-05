import Link from 'next/link';
import { LegalDocument } from '@/components/ui/LegalDocument';
import { routeMetadata } from '@/lib/routes';

export const metadata = routeMetadata('/accessibility');

export default function AccessibilityPage() {
  return (
    <LegalDocument
      eyebrow="Accessibility Statement"
      image="tabletWork"
      updated="5 October 2026"
      title={<>A digital state that works <span className="text-gold-metallic">for everyone.</span></>}
      lead="Public services must be usable by every member of the public. This statement sets out the standard we hold ourselves to and where we still fall short."
      sections={[
        {
          id: 'standard',
          heading: 'Our standard',
          body: <p>This platform aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, and to EN 301 549.</p>,
        },
        {
          id: 'what-we-do',
          heading: 'What we have done',
          body: (
            <ul>
              <li>A skip link to the main content on every page, and a logical heading order;</li>
              <li>Full keyboard navigation of menus, filters and accordions, with visible focus states;</li>
              <li>Text alternatives for informative images; decorative photography is hidden from screen readers;</li>
              <li>All animation is disabled automatically when your device requests reduced motion;</li>
              <li>Notifications are announced to assistive technology through polite live regions.</li>
            </ul>
          ),
        },
        {
          id: 'limitations',
          heading: 'Known limitations',
          body: (
            <ul>
              <li>Some data-dense tables in the officer and portal areas are not yet optimised for small screens;</li>
              <li>Official PDF editions of statutes are not yet available in tagged, accessible format;</li>
              <li>Content is currently published in English only; translations into the other official languages are in preparation.</li>
            </ul>
          ),
        },
        {
          id: 'feedback',
          heading: 'Feedback and alternative formats',
          body: (
            <p>
              If you find a barrier, or need information in another format such as large print, easy-read or audio, please{' '}
              <Link href="/contact">contact the public registry</Link>. We aim to respond within five working days.
            </p>
          ),
        },
      ]}
    />
  );
}
