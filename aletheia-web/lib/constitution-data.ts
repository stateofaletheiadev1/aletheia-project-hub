export interface ConstitutionalArticle {
  id: string;
  number: number;
  part: string;
  title: string;
  status: 'Operational' | 'Under Development' | 'Planned' | 'Proposed';
  summary: string;
  clauses: {
    number: string;
    text: string;
  }[];
  crossReferences: string[];
  responsibleInstitution: {
    name: string;
    href: string;
  };
  relatedLaw: {
    title: string;
    href: string;
  };
  relatedService?: {
    title: string;
    href: string;
  };
}

export const CONSTITUTION_DATA: ConstitutionalArticle[] = [
  {
    id: 'art-1',
    number: 1,
    part: 'Part I: Foundational Principles & Sovereignty',
    title: 'Nature of the Sovereign Covenant State',
    status: 'Operational',
    summary: 'Establishes Aletheia as a compact maritime nation founded upon truth, public proof, and covenant law.',
    clauses: [
      {
        number: '1(1)',
        text: 'The Sovereign Covenant State of Aletheia is an independent, European-oriented maritime nation whose supreme authority resides in the Covenant ratified by its citizens and constituent states.',
      },
      {
        number: '1(2)',
        text: 'The Sovereign Covenant State adopts as its governing method the principle of Aletheia — truth that is unhidden — whereby all public records, statutes, land titles, and financial appropriations shall be provable by cryptographic verification.',
      },
      {
        number: '1(3)',
        text: 'No executive decree, statutory act, or administrative rule shall possess legal validity if it contradicts the foundational covenants of this Constitution.',
      },
    ],
    crossReferences: ['art-2', 'art-5', 'art-58'],
    responsibleInstitution: {
      name: 'High Court of Aletheia',
      href: '/government#judiciary',
    },
    relatedLaw: {
      title: 'Constitutional Supremacy & Interpretation Act',
      href: '/laws/constitutional-supremacy',
    },
  },
  {
    id: 'art-2',
    number: 2,
    part: 'Part I: Foundational Principles & Sovereignty',
    title: 'The Five Official Languages & Equality of Access',
    status: 'Operational',
    summary: 'Codifies English as the working language alongside German, Dutch, Serbian, and Italian with full official standing.',
    clauses: [
      {
        number: '2(1)',
        text: 'The official languages of the Sovereign Covenant State of Aletheia are English, German, Dutch, Serbian, and Italian.',
      },
      {
        number: '2(2)',
        text: 'English shall serve as the official working language of the Covenant Assembly, the superior courts, and protocol standards. In the event of linguistic disparity in enacted statutes, the English text shall prevail.',
      },
      {
        number: '2(3)',
        text: 'Every citizen, resident, and e-resident has the inalienable right to communicate with any organ of public administration in any of the five official languages and receive a timely determination in that language.',
      },
    ],
    crossReferences: ['art-1', 'art-14'],
    responsibleInstitution: {
      name: 'Ministry of Foreign Affairs & Justice',
      href: '/government/ministry-of-foreign-affairs',
    },
    relatedLaw: {
      title: 'Official Languages & Public Administration Act',
      href: '/laws/languages-act',
    },
  },
  {
    id: 'art-7',
    number: 7,
    part: 'Part II: Territory & Maritime Jurisdiction',
    title: 'The Five Constituent Territories',
    status: 'Planned',
    summary: 'Defines the Federal District of Antioch and the four founding states: St. Barbara, Augustine, Benedict, and St. Brendan.',
    clauses: [
      {
        number: '7(1)',
        text: 'The territory of the Sovereign Covenant State comprises the Federal District of Antioch and the four constituent maritime states: St. Barbara State, Augustine State, Benedict State, and St. Brendan State.',
      },
      {
        number: '7(2)',
        text: 'The Federal District of Antioch is the perpetual capital city and seat of the sovereign legislative, executive, and judicial authorities of the Sovereign Covenant State.',
      },
      {
        number: '7(3)',
        text: 'The territorial sea extends 12 nautical miles from the baseline, flanked by a 24-nautical-mile contiguous zone and an Exclusive Economic Zone (EEZ) extending 200 nautical miles pursuant to the United Nations Convention on the Law of the Sea.',
      },
    ],
    crossReferences: ['art-8', 'art-9', 'art-47'],
    responsibleInstitution: {
      name: 'Ministry of Maritime Affairs & Ports',
      href: '/government/ministry-of-maritime',
    },
    relatedLaw: {
      title: 'Territorial Waters & Maritime Zones Act',
      href: '/laws/maritime-zones',
    },
    relatedService: {
      title: 'Territorial Masterplan & GIS Portal',
      href: '/development#map',
    },
  },
  {
    id: 'art-8',
    number: 8,
    part: 'Part III: Citizenship, E-Residency & Rights',
    title: 'Citizenship by Descent & Naturalisation',
    status: 'Planned',
    summary: 'Specifies the conditions of citizen membership, the Covenant Oath, and the issuance of the ICAO eMRTD passport.',
    clauses: [
      {
        number: '8(1)',
        text: 'Citizenship of Aletheia is acquired by descent from a citizen parent, or by grant of naturalisation following five years of lawful permanent residency, certified civic integration, and the solemn Covenant Oath.',
      },
      {
        number: '8(2)',
        text: 'Citizenship is a civic covenant and shall never be auctioned or conferred without the Covenant Oath. The Sovereign Covenant State may confer citizenship upon persons who make a qualifying investment in the development of the Sovereign Covenant State, as prescribed by statute, subject to enhanced due diligence, a clean criminal record and the public Covenant Oath.',
      },
      {
        number: '8(3)',
        text: 'Every citizen is entitled to an electronic machine-readable passport conforming to ICAO Doc 9303, bearing the coat of arms in gold foil upon Covenant Burgundy.',
      },
    ],
    crossReferences: ['art-11', 'art-12', 'art-13'],
    responsibleInstitution: {
      name: 'Immigration Directorate (ADSS)',
      href: '/adss#immigration',
    },
    relatedLaw: {
      title: 'Aletheian Nationality & Citizenship Act',
      href: '/laws/nationality-act',
    },
    relatedService: {
      title: 'Citizenship Standards & Oath Registry',
      href: '/citizenship',
    },
  },
  {
    id: 'art-11',
    number: 11,
    part: 'Part III: Citizenship, E-Residency & Rights',
    title: 'E-Residency & Digital Commercial Standing',
    status: 'Under Development',
    summary: 'Establishes the e-residency framework for borderless digital incorporation and contract execution.',
    clauses: [
      {
        number: '11(1)',
        text: 'The Sovereign Covenant State may confer e-residency upon approved international applicants who undergo biometric identity verification and background vetting.',
      },
      {
        number: '11(2)',
        text: 'E-residency confers digital legal identity, the capacity to establish and administer enterprises registered in Aletheia, and access to the Aletheia Payment Network.',
      },
      {
        number: '11(3)',
        text: 'E-residency does not confer physical residency, the right to enter territorial land, or political voting franchise within the Sovereign Covenant State.',
      },
    ],
    crossReferences: ['art-8', 'art-38', 'art-40'],
    responsibleInstitution: {
      name: 'Ministry of Digital State',
      href: '/technology',
    },
    relatedLaw: {
      title: 'Digital Identity & E-Residency Act',
      href: '/laws/e-residency-act',
    },
    relatedService: {
      title: 'Apply for Aletheia E-Residency',
      href: '/e-residency',
    },
  },
  {
    id: 'art-16',
    number: 16,
    part: 'Part IV: Monetary Architecture & Public Finance',
    title: 'The Aletheian Guilder (AEY) & Monetary Integrity',
    status: 'Under Development',
    summary: 'Establishes the national currency and its single issuer, and prohibits financing deficits by creating money.',
    clauses: [
      {
        number: '16(1)',
        text: 'The sovereign unit of account of the Sovereign Covenant State is the Aletheian Guilder (AEY), issued by the Reserve Bank of Aletheia in banknotes and on the StableChain.',
      },
      {
        number: '16(2)',
        text: 'The Reserve Bank of Aletheia shall issue currency only under published rules and shall not finance the deficits of the State. Every issue shall be recorded in a public register, and digital issuance on the StableChain shall be verifiable by any person.',
      },
      {
        number: '16(3)',
        text: 'The state shall levy zero tax on personal income, zero tax on capital gains, and zero tax on inheritances, financing public services through land ground leases and the Covenant Endowment Fund.',
      },
    ],
    crossReferences: ['art-1', 'art-30', 'art-32'],
    responsibleInstitution: {
      name: 'Reserve Bank of Aletheia & Treasury',
      href: '/treasury',
    },
    relatedLaw: {
      title: 'Monetary Sovereignty & StableChain Operating Act',
      href: '/laws/monetary-act',
    },
    relatedService: {
      title: 'Sovereign Treasury Dashboard',
      href: '/treasury',
    },
  },
  {
    id: 'art-23',
    number: 23,
    part: 'Part V: The Executive & Cabinet Capping',
    title: 'Limitation of Ministries to Nine Portfolios',
    status: 'Operational',
    summary: 'Constitutionally caps the national executive at nine ministries to permanently prevent bureaucratic proliferation.',
    clauses: [
      {
        number: '23(1)',
        text: 'Executive authority is vested in the Chancellor, who presides over a Cabinet strictly capped at nine ministries.',
      },
      {
        number: '23(2)',
        text: 'No additional ministry, state agency, or regulatory bureau may be established without an amendment to Schedule 3 of this Constitution.',
      },
      {
        number: '23(3)',
        text: 'Every statutory agency must undergo mandatory sunset review by the Assembly every eight years to justify its continued expenditure.',
      },
    ],
    crossReferences: ['art-24', 'art-28'],
    responsibleInstitution: {
      name: 'Office of the Chancellor',
      href: '/government#cabinet',
    },
    relatedLaw: {
      title: 'Executive Government & Ministerial Responsibilities Act',
      href: '/laws/executive-act',
    },
  },
  {
    id: 'art-46',
    number: 46,
    part: 'Part VI: Security & Defence',
    title: 'Aletheian Defence & Security Service (ADSS)',
    status: 'Planned',
    summary: 'Organizes national defence under unified civilian command while strictly segregating civilian policing.',
    clauses: [
      {
        number: '46(1)',
        text: 'The defence and public safety of the Sovereign Covenant State are entrusted to the Aletheian Defence & Security Service (ADSS), acting under the supreme command of the Minister of Security.',
      },
      {
        number: '46(2)',
        text: 'The Police Directorate shall remain institutionally distinct from military and maritime defence commands, dedicated exclusively to civilian law enforcement and human rights protection.',
      },
      {
        number: '46(3)',
        text: 'The deployment of military forces within the domestic territory is prohibited except under parliamentary proclamation of extreme national emergency.',
      },
    ],
    crossReferences: ['art-47', 'art-50', 'art-53'],
    responsibleInstitution: {
      name: 'Ministry of Security & Civil Defence',
      href: '/security',
    },
    relatedLaw: {
      title: 'ADSS Governance & Oversight Act',
      href: '/laws/adss-act',
    },
    relatedService: {
      title: 'ADSS Directory & Reporting',
      href: '/adss',
    },
  },
  {
    id: 'art-53',
    number: 53,
    part: 'Part VI: Security & Defence',
    title: 'Aletheian Cybersecurity Department',
    status: 'Operational',
    summary: 'Codifies the mandatory standalone national cybersecurity department to protect critical infrastructure and ledger nodes.',
    clauses: [
      {
        number: '53(1)',
        text: 'The Aletheian Cybersecurity Department is established as a permanent sovereign agency charged with the protection of state networks, validator clusters, citizen identity registries, and maritime telemetry.',
      },
      {
        number: '53(2)',
        text: 'The Department shall operate the National Computer Emergency Response Team (CERT) and administer a public Coordinated Vulnerability Disclosure programme.',
      },
      {
        number: '53(3)',
        text: 'The Department possesses no statutory authority to conduct general domestic mass surveillance, which is strictly unconstitutional.',
      },
    ],
    crossReferences: ['art-46', 'art-16', 'art-1'],
    responsibleInstitution: {
      name: 'Aletheian Cybersecurity Department',
      href: '/adss/cybersecurity',
    },
    relatedLaw: {
      title: 'National Cyber Resilience & Critical Infrastructure Act',
      href: '/laws/cyber-resilience',
    },
    relatedService: {
      title: 'Coordinated Vulnerability Disclosure',
      href: '/adss/cybersecurity#disclosure',
    },
  },
];
