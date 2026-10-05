import Link from 'next/link';
import { LegalDocument } from '@/components/ui/LegalDocument';
import { routeMetadata } from '@/lib/routes';

export const metadata = routeMetadata('/terms');

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Terms of Use"
      image="lawLibrary"
      updated="5 October 2026"
      title={<>Terms of use of the <span className="text-gold-metallic">official platform.</span></>}
      lead="The conditions under which the digital platform of the Covenant State of Aletheia may be used, and the limits of what it represents."
      sections={[
        {
          id: 'status',
          heading: 'Status of information',
          body: (
            <p>
              Aletheia is a developing project. Every institution, service and asset on this platform is labelled Operational, Under
              Development, Planned, Proposed or Vision. Only items marked Operational are functioning today; nothing on this site should be
              read as a representation that a Planned or Proposed item exists. See <Link href="/transparency">Public Transparency</Link>.
            </p>
          ),
        },
        {
          id: 'no-offer',
          heading: 'No offer of securities or citizenship',
          body: (
            <p>
              Nothing on this platform constitutes an offer to sell securities, bonds or any financial instrument, nor an offer of
              citizenship. Citizenship is not for sale. Any investment information is descriptive and subject to a formal prospectus where
              required by law.
            </p>
          ),
        },
        {
          id: 'authoritative',
          heading: 'Authoritative texts',
          body: (
            <p>
              Where a statute, decree or the Covenant is summarised, the text published in the Official Gazette prevails. Translations into
              other official languages are provided for convenience; the English text is authoritative.
            </p>
          ),
        },
        {
          id: 'acceptable-use',
          heading: 'Acceptable use',
          body: (
            <ul>
              <li>Do not attempt to access portal or officer areas without authorisation;</li>
              <li>Do not probe, scan or test the security of the platform except through coordinated disclosure;</li>
              <li>Do not use the national arms, flag or name of Aletheia to imply official endorsement.</li>
            </ul>
          ),
        },
        {
          id: 'reuse',
          heading: 'Re-use of public information',
          body: (
            <p>
              Statutes, Gazette bulletins and published datasets may be freely re-used with attribution. The coat of arms, flags and
              heraldic devices are protected national symbols and may not be reproduced commercially.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to these terms',
          body: <p>These terms may be amended. Material changes are announced in the <Link href="/news">Official Gazette</Link>.</p>,
        },
      ]}
    />
  );
}
