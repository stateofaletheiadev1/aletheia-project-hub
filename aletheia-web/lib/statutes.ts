/** Codified statutes of the Sovereign Covenant State — source of truth for /laws/[slug]. */

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
    article: 'Constitution Article 1 § 3',
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
    article: 'Constitution Article 2 § 2',
    date: '2026-01-28',
    hash: '14ea892018fa34091ec87201948ba209ef731204891230fca890214890ecb820',
    preamble: 'An Act providing for the official language regime of the Sovereign Covenant State, ensuring equal dignity for European languages and seamless global diplomatic representation.',
    sections: [
      { number: 'Section 1', heading: 'Official Languages', text: 'The official languages of The Sovereign Covenant State of Aletheia are English, German, Dutch, Serbian, and Italian. English shall serve as the primary procedural language for international commercial contracts.' },
      { number: 'Section 2', heading: 'Bilingual & Multilingual State Documents', text: 'All primary constitutional texts, biometric passport inscriptions, and legal codes shall be published concurrently in the five official languages.' },
      { number: 'Section 3', heading: 'Judicial Proceedings', text: 'Parties to any civil, commercial, or criminal proceeding possess the statutory right to sworn simultaneous translation without fee.' },
    ],
    signatory: 'Minister of Foreign Affairs & Justice',
  },
  'maritime-zones': {
    slug: 'maritime-zones',
    code: 'ACT-2026-03',
    title: 'Maritime Zones & UNCLOS Jurisdiction Act',
    article: 'Constitution Article 3 § 4',
    date: '2026-02-05',
    hash: '77ba90123ca87201948ea20914be872190847b2c01948fe2198034a890123ca7',
    preamble: 'An Act defining the maritime territorial limits, contiguous zone, and Exclusive Economic Zone of Aletheia in strict compliance with the United Nations Convention on the Law of the Sea.',
    sections: [
      { number: 'Section 1', heading: 'Territorial Sea Limit', text: 'The sovereignty of Aletheia extends to a territorial sea baseline of 12 nautical miles, encompassing all civil platforms, breakwaters, and natural baselines.' },
      { number: 'Section 2', heading: 'Exclusive Economic Zone', text: 'The Sovereign Covenant State claims an Exclusive Economic Zone (EEZ) extending up to 200 nautical miles for the purpose of exploring, conserving, and managing marine pelagic resources, wave energy generation, and offshore wind.' },
      { number: 'Section 3', heading: 'Right of Innocent Passage', text: 'Foreign civilian and merchant vessels enjoy the right of innocent passage through territorial waters pursuant to international maritime conventions.' },
    ],
    signatory: 'Minister of Territorial Development & ADSS Maritime Admiral',
  },
  'nationality-act': {
    slug: 'nationality-act',
    code: 'ACT-2026-04',
    title: 'Nationality & Naturalisation Act',
    article: 'Constitution Article 8 § 5',
    date: '2026-02-14',
    hash: '3c9902ba14ff28e67a01d5e390c88461ab209ef731478201fa8892ca3401ef62',
    preamble: 'An Act setting forth the rights, duties, and acquisition criteria for Aletheian citizenship, defining naturalisation by physical residence and covenant awards.',
    sections: [
      { number: 'Section 1', heading: 'Citizenship by Covenant', text: 'Citizenship is a voluntary civic covenant. No person shall be compelled into citizenship, nor stripped of nationality for political expression.' },
      { number: 'Section 2', heading: 'Naturalisation Requirements', text: 'Lawful permanent residents who have resided physically in Aletheian territory for five continuous years and demonstrated knowledge of the Covenant are entitled to apply for full naturalisation.' },
      { number: 'Section 2A', heading: 'Covenant Investor Citizenship', text: 'A person aged eighteen or over who makes a qualifying investment — a National Development Contribution of 250,000 AEY, or a subscription of 500,000 AEY in Covenant Development Bonds held for five years — may be granted citizenship without a period of residence, upon clearing enhanced due diligence on identity and source of funds, holding no serious criminal conviction in the preceding ten years, and swearing the public Covenant Oath. Spouses and dependent children may be included upon a further qualifying amount for each.' },
      { number: 'Section 3', heading: 'Biometric Passport Right', text: 'Every confirmed citizen possesses an inalienable statutory right to an ICAO Doc 9303 compliant biometric passport issued in Covenant Burgundy.' },
    ],
    signatory: 'Chancellor of the Sovereign Covenant State & Registrar General',
  },
  'e-residency-act': {
    slug: 'e-residency-act',
    code: 'ACT-2026-05',
    title: 'Digital E-Residency & Virtual Jurisdiction Act',
    article: 'Constitution Article 9 § 4',
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
    article: 'Constitution Article 14 § 6',
    date: '2026-03-04',
    hash: 'bee5ed66b8935fd4ee0c11db3adb79337ed73bdd5299f54a9dbd0476991b8450',
    preamble: 'An Act establishing the Aletheian Guilder (AEY) as the national currency and the Reserve Bank of Aletheia as its issuer, and prohibiting the monetary financing of the State.',
    sections: [
      { number: 'Section 1', heading: 'The National Currency', text: 'The Aletheian Guilder (AEY) is the currency of the Sovereign Covenant State, issued by the Reserve Bank of Aletheia in banknotes and on the StableChain.' },
      { number: 'Section 2', heading: 'Rules of Issuance', text: 'The Reserve Bank of Aletheia shall issue AEY only under rules it has adopted and published, and shall record every issue and withdrawal in a public register.' },
      { number: 'Section 3', heading: 'No Monetary Financing', text: 'The Reserve Bank of Aletheia shall not finance the expenditure of the State by issuing currency.' },
    ],
    signatory: 'Governor of the Reserve Bank of Aletheia & Minister of Treasury',
  },
  'executive-act': {
    slug: 'executive-act',
    code: 'ACT-2026-07',
    title: 'Executive Cabinet & Ministerial Portfolios Act',
    article: 'Constitution Article 15 § 5',
    date: '2026-03-12',
    hash: '44d270f72e1664c91dd71b7a01ef783a5dce93d3ab85c7fb12518bf2964088e4',
    preamble: 'An Act governing the structure, powers, and constitutional limits of the executive government, enforcing the statutory maximum of nine ministries.',
    sections: [
      { number: 'Section 1', heading: 'Cabinet Cap', text: 'The executive Cabinet shall consist of the Chancellor and not more than eight ministers of state. No additional ministry may be created without constitutional amendment.' },
      { number: 'Section 2', heading: 'Parliamentary Confirmation', text: 'All ministerial nominees must be examined and confirmed by a majority vote of the Covenant Assembly.' },
      { number: 'Section 3', heading: 'Statutory Transparency', text: 'All executive orders and ministerial determinations must be signed with official cryptographic keys and published in the Official Gazette within 24 hours of enactment.' },
    ],
    signatory: 'Chancellor of the Sovereign Covenant State & Speaker of the Covenant Assembly',
  },
  'adss-act': {
    slug: 'adss-act',
    code: 'ACT-2026-08',
    title: 'Aletheian Defence & Security Service (ADSS) Governance Act',
    article: 'Constitution Article 18 § 4',
    date: '2026-03-20',
    hash: '4489021fa89023ebc87201948ea20914bca890214890ec8201948ea20914801e',
    preamble: 'An Act regulating the armed defence forces, civilian police, and coast guard services, enforcing strict civilian control and prohibiting internal domestic military policing.',
    sections: [
      { number: 'Section 1', heading: 'Civilian Subordination', text: 'The Aletheian Defence & Security Service is subordinated to civilian authority. The civilian Minister of Security exercises executive direction over all operational commands.' },
      { number: 'Section 2', heading: 'Prohibition of Domestic Military Policing', text: 'Military personnel and defense hardware shall never be deployed for domestic civilian crowd control or routine law enforcement.' },
      { number: 'Section 3', heading: 'Maritime Search & Rescue Mandate', text: 'The Coast Guard Directorate is statutorily bound to render immediate maritime humanitarian assistance to any vessel in distress regardless of flag or nationality.' },
    ],
    signatory: 'Minister of Security & Civil Defence',
  },
  'cyber-resilience': {
    slug: 'cyber-resilience',
    code: 'ACT-2026-09',
    title: 'Critical National Infrastructure & Cyber Resilience Act',
    article: 'Constitution Article 19 § 3',
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
