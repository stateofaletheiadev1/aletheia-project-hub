/** Proposed Acts of the Sovereign Covenant State: drafts without legal force. Source of truth for /laws/[slug]. */

export interface StatuteDetail {
  slug: string;
  code: string;
  title: string;
  article: string;
  date: string;
  hash: string;
  preamble: string;
  sections: {
    number: string;
    heading: string;
    text: string;
  }[];
  signatory: string;
}

export const STATUTE_DATABASE: Record<string, StatuteDetail> = {
  'constitutional-supremacy': {
    slug: 'constitutional-supremacy',
    code: 'ACT-2026-01',
    title: 'Constitutional Supremacy & Judicial Review Act',
    article: 'Constitution Article 3',
    date: '2026-01-20',
    hash: '8f2b7a4c91e3d085fa49b817e4521098ef7321ac90b34d76a218fce1b2049e91',
    preamble: 'An Act to solemnly affirm the inviolable supremacy of the Covenant of Aletheia as the highest law of the land, establishing the High Court of Justice as the sole arbiter of constitutional conformity and voiding all conflicting executive determinations.',
    sections: [
      { number: 'Section 1', heading: 'Supremacy Invariant', text: 'No statute, treaty, administrative decree, or municipal regulation shall have legal force or effect to the extent that it conflicts with any provision of the Covenant of Aletheia.' },
      { number: 'Section 2', heading: 'Exclusive Judicial Review', text: 'The High Court of Justice possesses exclusive original and appellate jurisdiction to hear constitutional challenges brought by any citizen, resident, or parliamentary minority.' },
      { number: 'Section 3', heading: 'Automatic Invalidation', text: 'Any legislative enactment or executive decree declared unconstitutional by a majority of the High Court is void ab initio.' },
    ],
    signatory: 'Chancellor & President of the High Court',
  },
  'languages-act': {
    slug: 'languages-act',
    code: 'ACT-2026-02',
    title: 'Official Languages & Diplomatic Communication Act',
    article: 'Constitution Article 11(2)',
    date: '2026-01-28',
    hash: 'adfff80b8341114fbd4a689b0cea99e489ce1b3133272696963edd636d0a13e2',
    preamble: 'An Act providing for the official language regime of the Sovereign Covenant State, ensuring equal dignity for European languages and seamless global diplomatic representation.',
    sections: [
      { number: 'Section 1', heading: 'Official Languages', text: 'The official languages of The Sovereign Covenant State of Aletheia are English, German, Dutch, Serbian, and Italian. English shall serve as the primary procedural language for international commercial contracts.' },
      { number: 'Section 2', heading: 'Bilingual & Multilingual State Documents', text: 'All primary constitutional texts, travel-document inscriptions, and legal codes shall be published concurrently in the five official languages.' },
      { number: 'Section 3', heading: 'Judicial Proceedings', text: 'Parties to any civil, commercial, or criminal proceeding possess the statutory right to sworn simultaneous translation without fee.' },
    ],
    signatory: 'Minister of Foreign Affairs & Justice',
  },
  'maritime-zones': {
    slug: 'maritime-zones',
    code: 'ACT-2026-03',
    title: 'Maritime Zones Act',
    article: 'Constitution Article 33',
    date: '2026-02-05',
    hash: 'a3561c030cfa6f046808cdcfc22a8a03d31a51b0617ed4d4de503b7c70e664e3',
    preamble: 'An Act providing that Aletheia’s maritime claims shall be in strict compliance with the United Nations Convention on the Law of the Sea.',
    sections: [
      { number: 'Section 1', heading: 'No Excessive Claims', text: 'Aletheia’s platforms are artificial islands under the Law of the Sea. Aletheia shall claim no territorial sea for them, and no zone of any kind beyond what the Convention allows.' },
      { number: 'Section 2', heading: 'Marine Resources', text: 'Marine resources, wave energy and offshore wind used by Aletheia shall be managed for conservation, and all environmental data shall be published.' },
      { number: 'Section 3', heading: 'Freedom of Navigation', text: 'Foreign vessels shall enjoy freedom of navigation around Aletheia’s platforms, outside any lawful safety zone, as the Law of the Sea provides.' },
    ],
    signatory: 'Minister of Maritime Affairs & Ports',
  },
  'nationality-act': {
    slug: 'nationality-act',
    code: 'ACT-2026-04',
    title: 'Nationality & Naturalisation Act',
    article: 'Constitution Article 41(4)',
    date: '2026-02-14',
    hash: '62c38c614d4e59bbd1aa762296f101f262c3f731034383dccc46d0ff9ecb879a',
    preamble: 'An Act setting forth the rights, duties, and acquisition criteria for Aletheian citizenship, conferred only by birth or by naturalisation through physical residence.',
    sections: [
      { number: 'Section 1', heading: 'Citizenship by Covenant', text: 'Citizenship is a voluntary civic covenant. No person shall be compelled into citizenship, nor stripped of nationality for political expression.' },
      { number: 'Section 2', heading: 'Naturalisation Requirements', text: 'Lawful permanent residents who have resided physically in Aletheian territory for five continuous years and demonstrated knowledge of the Covenant are entitled to apply for full naturalisation.' },
      { number: 'Section 2A', heading: 'No Citizenship for Payment', text: 'Citizenship shall never be granted in return for investment, contribution or payment of any kind.' },

      { number: 'Section 3', heading: 'Travel Document', text: 'Once Aletheia has the lawful authority to issue one, every citizen shall be entitled to a travel document in Covenant Burgundy.' },
    ],
    signatory: 'Chancellor of the Sovereign Covenant State & Registrar General',
  },
  'e-residency-act': {
    slug: 'e-residency-act',
    code: 'ACT-2026-05',
    title: 'Digital E-Residency & Virtual Jurisdiction Act',
    article: 'Constitution Article 185',
    date: '2026-02-22',
    hash: '0b8b55989f1bad1fd64735d3603d8627212b6528bb88f5952f8e24570c6d9582',
    preamble: 'An Act establishing the digital identity framework of the Sovereign Covenant State, empowering international entrepreneurs to form companies, execute contracts, and utilize state settlement rails.',
    sections: [
      { number: 'Section 1', heading: 'Digital Identity Inscription', text: 'E-Residency is a cryptographic digital identity conferring legal capacity to sign contracts and form commercial entities under Aletheian jurisdiction.' },
      { number: 'Section 2', heading: 'Physical Rights Exclusion', text: 'E-Residency expressly conveys no right to enter, physically reside, work as an employee, or claim citizenship or travel documents of the Sovereign Covenant State.' },
      { number: 'Section 3', heading: 'Tax Neutrality', text: 'E-residents operating foreign-sourced digital businesses through an Aletheian corporate vehicle are subject to zero personal income tax in Aletheia.' },
    ],
    signatory: 'Minister of Digital State & Registrar of Companies',
  },
  'monetary-act': {
    slug: 'monetary-act',
    code: 'ACT-2026-06',
    title: 'Monetary Architecture Act',
    article: 'Constitution Articles 152–162',
    date: '2026-03-04',
    hash: 'bee5ed66b8935fd4ee0c11db3adb79337ed73bdd5299f54a9dbd0476991b8450',
    preamble: 'An Act establishing the Aletheian Guilder (AEY) as the national currency and the Reserve Bank of Aletheia as its issuer, and prohibiting the monetary financing of the State.',
    sections: [
      { number: 'Section 1', heading: 'The National Currency', text: 'The Aletheian Guilder (AEY) is the currency of the Sovereign Covenant State, issued by the Reserve Bank of Aletheia in banknotes and on the AletheiaChain.' },
      { number: 'Section 2', heading: 'Rules of Issuance', text: 'The Reserve Bank of Aletheia shall issue AEY only under rules it has adopted and published, and shall record every issue and withdrawal in a public register.' },
      { number: 'Section 3', heading: 'No Monetary Financing', text: 'The Reserve Bank of Aletheia shall not finance the expenditure of the State by issuing currency.' },
    ],
    signatory: 'Governor of the Reserve Bank of Aletheia & Minister of Treasury',
  },
  'executive-act': {
    slug: 'executive-act',
    code: 'ACT-2026-07',
    title: 'Executive Cabinet & Ministerial Portfolios Act',
    article: 'Constitution Articles 125 and 129',
    date: '2026-03-12',
    hash: '5d17338bfea5800bf0a25e1b1d869a531084b16aab0443b309fe0d5b9ee3f0f0',
    preamble: 'An Act governing the structure, powers, and constitutional limits of the executive government, enforcing the statutory maximum of nine ministries.',
    sections: [
      { number: 'Section 1', heading: 'Cabinet Cap', text: 'The executive Cabinet shall consist of the Chancellor and not more than nine ministers, each heading one of the ministries listed in Schedule 3 of the Constitution. No additional ministry may be created without constitutional amendment.' },
      { number: 'Section 2', heading: 'Parliamentary Confirmation', text: 'All ministerial nominees must be examined and confirmed by a majority vote of the Covenant Assembly.' },
      { number: 'Section 3', heading: 'Statutory Transparency', text: 'All executive orders and ministerial determinations must be signed with published cryptographic keys and published in the Gazette within 24 hours of enactment.' },
    ],
    signatory: 'Chancellor of the Sovereign Covenant State & Speaker of the Covenant Assembly',
  },
  'adss-act': {
    slug: 'adss-act',
    code: 'ACT-2026-08',
    title: 'Aletheian Defence & Security Service (ADSS) Governance Act',
    article: 'Constitution Article 188',
    date: '2026-03-20',
    hash: '4a44d2a77acfb2e0b3842f3e71e2a227bb1f59e2cfa43d544dad655cf7a09040',
    preamble: 'An Act regulating civil-protection, civilian police and coastguard services, enforcing strict civilian control and prohibiting the use of any other service for domestic policing.',
    sections: [
      { number: 'Section 1', heading: 'Civilian Subordination', text: 'The Aletheian Defence & Security Service is subordinated to civilian authority. The civilian Minister of Resilience & Civil Protection exercises executive direction over all its services.' },
      { number: 'Section 2', heading: 'Policing Only by the Police', text: 'No service other than the Police Directorate shall ever be deployed for crowd control or routine law enforcement.' },
      { number: 'Section 3', heading: 'Maritime Search & Rescue Mandate', text: 'The Coast Guard Directorate is statutorily bound to render immediate maritime humanitarian assistance to any vessel in distress regardless of flag or nationality.' },
    ],
    signatory: 'Minister of Resilience & Civil Protection',
  },
  'cyber-resilience': {
    slug: 'cyber-resilience',
    code: 'ACT-2026-09',
    title: 'Critical National Infrastructure & Cyber Resilience Act',
    article: 'Constitution Article 196',
    date: '2026-03-29',
    hash: '66189023ebca87201948ea20914801e991204890ecb8201948ea20914801fa88',
    preamble: 'An Act providing for the mandatory cyber hardening, post-quantum cryptographic standards, and optical air-gapping of sovereign ledgers and public utility grids.',
    sections: [
      { number: 'Section 1', heading: 'Validator Consensus Security', text: 'All state consensus validator nodes must be hosted on sovereign hardware with FIPS 140-3 Level 4 HSM key storage and multi-carrier BGP protection.' },
      { number: 'Section 2', heading: 'SCADA Optical Isolation', text: 'Industrial control systems governing offshore wind arrays, port handling gantries, and water desalination must be physically isolated from the public internet via unidirectional optical data diodes.' },
      { number: 'Section 3', heading: 'Mandatory Incident Reporting', text: 'Critical infrastructure operators must report all cyber intrusion attempts to the CSIRT-ALE national desk within sixty minutes of detection.' },
    ],
    signatory: 'Director of the National Cybersecurity Directorate',
  },
};

export function getStatute(slug: string): StatuteDetail | undefined {
  return STATUTE_DATABASE[slug];
}
