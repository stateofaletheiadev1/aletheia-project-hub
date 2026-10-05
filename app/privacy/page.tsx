import Link from 'next/link';
import { LegalDocument } from '@/components/ui/LegalDocument';
import { routeMetadata } from '@/lib/routes';

export const metadata = routeMetadata('/privacy');

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Data Protection"
      image="remoteWork"
      updated="5 October 2026"
      title={<>Your data belongs <span className="text-gold-metallic">to you.</span></>}
      lead="How this platform collects, protects and strictly limits the use of personal information — written to the standard of the EU General Data Protection Regulation."
      sections={[
        {
          id: 'controller',
          heading: 'Who is responsible',
          body: (
            <p>
              The data controller for this platform is the Ministry of Digital State &amp; Registries of the Covenant State of Aletheia.
              Questions about this notice can be sent to <a href="mailto:chancery@aletheia.gov">chancery@aletheia.gov</a>.
            </p>
          ),
        },
        {
          id: 'what-we-collect',
          heading: 'What we collect',
          body: (
            <>
              <p>Browsing the public pages of this site requires no account and sets no tracking or advertising cookies. We collect only:</p>
              <ul>
                <li>Information you choose to submit, such as an enquiry, a Gazette subscription or an application in the citizen portal;</li>
                <li>Minimal technical logs (IP address, time, page requested) retained for no more than 30 days for security purposes.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'ledger',
          heading: 'What never goes on the ledger',
          body: (
            <p>
              Personal data, identity documents, biometrics and medical records are never written to StableChain. The ledger stores only
              cryptographic hashes and receipts that prove a record exists, or that consent was given, without revealing its content.
              This makes erasure possible: deleting the underlying record leaves an unreadable hash behind.
            </p>
          ),
        },
        {
          id: 'purpose',
          heading: 'How we use it',
          body: (
            <p>
              Data is used only for the purpose for which you provided it, on the legal basis of your consent or the performance of a public
              task. It is never sold, never used for advertising and never shared with third parties except where a statute requires it —
              and every such disclosure is itself logged and auditable.
            </p>
          ),
        },
        {
          id: 'rights',
          heading: 'Your rights',
          body: (
            <ul>
              <li>Access a copy of the data held about you, including the log of who has viewed it;</li>
              <li>Correct inaccurate data, and erase data that is no longer required;</li>
              <li>Withdraw consent at any time, and object to or restrict processing;</li>
              <li>Receive your data in a portable, machine-readable format;</li>
              <li>Complain to the independent Data Protection Commissioner.</li>
            </ul>
          ),
        },
        {
          id: 'security',
          heading: 'Security',
          body: (
            <p>
              Systems are protected under the oversight of the{' '}
              <Link href="/adss/cybersecurity">Aletheian Cybersecurity Department</Link>, using encryption in transit and at rest, hardware-backed
              key storage and continuous monitoring. Suspected vulnerabilities can be reported through coordinated disclosure.
            </p>
          ),
        },
      ]}
    />
  );
}
