'use client';

import { renderOfficialPdf, type OfficialPdfSpec } from '@/lib/pdf/builder';
import type { CompanyRecord, PortalAccount, PortalDocument } from '@/lib/auth';

/**
 * Personal documents in the citizen portal, rendered in the browser from the registry
 * records: the holder's account and the issued document (its reference and SHA-256
 * fingerprint, which officers can check against the registry).
 */

export type PortalDocumentKind =
  | 'e-residence-certificate'
  | 'company-charter'
  | 'tax-residency'
  | 'apostille'
  | 'digital-credential';

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

type Holder = { name: string; id: string; did: string; status: string };

function spec(kind: PortalDocumentKind, u: Holder, doc: PortalDocument, company?: CompanyRecord): Omit<OfficialPdfSpec, 'arms'> {
  const today = () => fmt(doc.createdAt);
  const SPECIMEN: [string, string] = ['Registry reference', `${doc.reference} · SHA-256 ${doc.hash.slice(0, 16)}…`];
  const holder: [string, string][] = [['Holder', u.name], ['Registry number', u.id], ['Decentralised identifier', u.did]];
  switch (kind) {
    case 'e-residence-certificate':
      return {
        code: `ERES-${u.id.slice(-6)}`,
        kind: 'Certificate of E-Residency',
        title: 'Certificate of Digital Residency',
        meta: [...holder, ['Status', u.status], ['Issued', today()], SPECIMEN],
        lead: `The General Secretariat of State certifies that ${u.name} has been admitted as an e-resident of the Sovereign Covenant State of Aletheia under the Digital E-Residency & Virtual Jurisdiction Act.`,
        sections: [
          { heading: 'Rights conferred', paragraphs: ['Digital legal identity; the capacity to establish and administer enterprises registered in Aletheia; access to the Aletheia Payment Network; remote execution of contracts under Aletheian law.'] },
          { heading: 'Limitations', paragraphs: ['E-residency confers no right of physical residence, no entitlement to healthcare, and no right to vote. It is not a travel document.'] },
        ],
        attestation: ['General Secretariat of State', 'Verify at stateofaletheia.org using the registry number above'],
      };
    case 'company-charter':
      return {
        code: `CRC-${u.id.slice(-6)}`,
        kind: 'Commercial Register Charter',
        title: 'Charter of Incorporation',
        meta: [...(company ? ([['Company', company.name], ['Registration number', company.regNumber], ['Legal form', company.structure]] as [string, string][]) : []), ['Founder', u.name], ['Founder registry number', u.id], ['Registered', today()], SPECIMEN],
        lead: company
          ? `The Registrar of Companies records the incorporation of ${company.name} (${company.regNumber}), with registered office in the Federal District of Antioch.`
          : 'The Registrar of Companies records the incorporation of the company named in the founder’s portal filing, with registered office in the Federal District of Antioch.',
        sections: [
          { number: 'Article 1', heading: 'Form', paragraphs: ['The company is a private company limited by shares, governed by the Companies Act and English commercial law as applied in Aletheia.'] },
          { number: 'Article 2', heading: 'Registry', paragraphs: ['The charter and every subsequent filing are hashed and inscribed on the public ledger. Beneficial ownership is held in the closed register.'] },
        ],
        attestation: ['Registrar of Companies'],
      };
    case 'tax-residency':
      return {
        code: `FSA-${u.id.slice(-6)}`,
        kind: 'Fiscal Status Attestation',
        title: 'Declaration of Fiscal Status',
        meta: [...holder, ['Attested', today()], SPECIMEN],
        lead: `The Ministry of Treasury & Finance attests that ${u.name} is registered with the Sovereign Covenant State and that no personal income tax is levied by the Sovereign Covenant State, by constitutional prohibition.`,
        sections: [
          { heading: 'Important', paragraphs: ['E-residency does not by itself establish tax residence for the purposes of any other jurisdiction. Holders remain responsible for their obligations where they live.'] },
        ],
        attestation: ['Ministry of Treasury & Finance'],
      };
    case 'apostille':
      return {
        code: `APO-${u.id.slice(-6)}`,
        kind: 'Apostille (Hague Convention of 5 October 1961)',
        title: 'Digital Apostille',
        meta: [['Document holder', u.name], ['Registry number', u.id], ['Issued', today()], SPECIMEN],
        sections: [
          {
            paragraphs: [
              '1. Country: The Sovereign Covenant State of Aletheia',
              '2. This public document has been signed by the General Secretariat of State',
              '3. Acting in the capacity of Registrar of Persons',
              '4. Bears the seal of the Sovereign Covenant State',
              '5. Certified at Antioch',
              `6. On ${today()}`,
              '7. By the High Court Notarial Bureau',
            ],
          },
        ],
        attestation: ['High Court Notarial Bureau'],
      };
    case 'digital-credential':
      return {
        code: `VC-${u.id.slice(-6)}`,
        kind: 'Verifiable Credential — printed copy',
        title: 'National Digital Identity Credential',
        meta: [...holder, ['Status', u.status], ['Printed', today()], SPECIMEN],
        lead: 'A printed representation of the holder’s W3C Verifiable Credential. The credential itself is held in the holder’s wallet; this copy is for reference only.',
        sections: [{ heading: 'Verification', paragraphs: ['Relying parties verify the credential by resolving the decentralised identifier above against the State Key Directory.'] }],
        attestation: ['Ministry of Digital State & Registries'],
      };
  }
}

/** Renders an issued portal document and triggers a browser download. */
export async function downloadPortalDocument(kind: PortalDocumentKind, filename: string, account: PortalAccount, doc: PortalDocument, company?: CompanyRecord): Promise<void> {
  const arms = new Uint8Array(await (await fetch('/brand/arms-pdf.png')).arrayBuffer());
  const holder = { name: account.name, id: account.id, did: account.did, status: account.statusLabel };
  const bytes = await renderOfficialPdf({ ...spec(kind, holder, doc, company), arms });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
