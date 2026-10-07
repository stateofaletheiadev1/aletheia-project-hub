export interface NavItem {
  label: string;
  href: string;
  description?: string;
  badge?: string;
  children?: {
    group: string;
    items: {
      title: string;
      href: string;
      desc: string;
      status?: 'Operational' | 'Under Development' | 'Planned' | 'Proposed' | 'Vision';
    }[];
  }[];
}

export const MAIN_NAVIGATION: NavItem[] = [
  {
    label: 'Aletheia',
    href: '/aletheia',
    children: [
      {
        group: 'Identity & Foundations',
        items: [
          { title: 'Discover Aletheia', href: '/aletheia', desc: 'The founding idea, maritime heritage, and national symbols' },
          { title: 'National Vision', href: '/vision', desc: 'The long-term civic compact and European standards' },
          { title: 'National Symbols', href: '/identity', desc: 'Coat of arms, the Star of Truth, flags, and the ICAO passport' },
          { title: 'Public Transparency', href: '/transparency', desc: 'Audited accounts, registry verification, and public records', status: 'Operational' },
        ],
      },
      {
        group: 'Communications',
        items: [
          { title: 'Official Gazette & News', href: '/news', desc: 'Decrees, appointments, roadmap updates, and statements' },
          { title: 'Public Documents', href: '/documents', desc: 'The Covenant, Acts, reports, and APS protocol standards' },
          { title: 'Contact & Representation', href: '/contact', desc: 'Diplomatic missions, press inquiries, and public registry' },
          { title: 'Questions & Answers', href: '/faq', desc: 'Plain answers on membership, money, data, and status' },
        ],
      },
      {
        group: 'Society & Public Services',
        items: [
          { title: 'Life in Aletheia', href: '/society', desc: 'Languages, culture, the civic calendar, and maritime heritage' },
          { title: 'Health & Social Care', href: '/healthcare', desc: 'Universal covenant healthcare and patient-held records', status: 'Planned' },
          { title: 'Education & Research', href: '/education', desc: 'Bilingual schools, the National University, and research grants', status: 'Planned' },
        ],
      },
    ],
  },
  {
    label: 'Government',
    href: '/government',
    children: [
      {
        group: 'Constitutional Organs',
        items: [
          { title: 'The Constitution', href: '/constitution', desc: 'The Covenant of Aletheia: searchable articles, permalinks and diffs' },
          { title: 'The Covenant Assembly', href: '/government#assembly', desc: '61-member legislative parliament elected by PR', status: 'Planned' },
          { title: 'Council of the States', href: '/government#council', desc: '15-member territorial review chamber representing the 5 states', status: 'Planned' },
          { title: 'The Chancellor & Cabinet', href: '/government#cabinet', desc: 'Executive leadership capped at nine ministries' },
          { title: 'The Judiciary & High Court', href: '/government#judiciary', desc: 'Constitutional, civil, and automated dispute resolution', status: 'Planned' },
        ],
      },
      {
        group: 'The Nine Ministries',
        items: [
          { title: 'Treasury & Finance', href: '/treasury', desc: 'Covenant Endowment, public balance sheet, bond issuance' },
          { title: 'Digital State & Registries', href: '/technology', desc: 'StableChain state validators, identity, e-residency' },
          { title: 'Security & Civil Defence', href: '/security', desc: 'Civilian governance of ADSS and cyber resilience' },
          { title: 'Foreign Affairs & Justice', href: '/government/ministry-of-foreign-affairs', desc: 'Bilateral covenants, passports, dispute systems' },
          { title: 'All Ministries Directory', href: '/government', desc: 'Complete ministerial directory and statutory mandates' },
        ],
      },
    ],
  },
  {
    label: 'Citizenship',
    href: '/citizenship',
    description: 'Membership by covenant: rights, obligations, and naturalisation path',
    children: [
      {
        group: 'Membership by Covenant',
        items: [
          { title: 'Citizenship Standards', href: '/citizenship', desc: 'Rights, obligations, and the five pathways to citizenship' },
          { title: 'Apply for Citizenship', href: '/citizenship/apply', desc: 'Eligibility checker for naturalisation and the investor route', status: 'Under Development' },
          { title: 'The Aletheian Passport', href: '/passport', desc: 'ICAO Doc 9303 eMRTD in Covenant Burgundy' },
        ],
      },
      {
        group: 'The National Register',
        items: [
          { title: 'Registry & Revenue', href: '/registry', desc: 'Citizens, e-residents, and funds raised to build the Sovereign Covenant State' },
          { title: 'E-Residency', href: '/e-residency', desc: 'Digital state access for global founders' },
          { title: 'Immigration & Residence', href: '/immigration', desc: 'Visas and residence permits — the path to naturalisation' },
        ],
      },
    ],
  },
  {
    label: 'E-Residency',
    href: '/e-residency',
    description: 'Digital state access for global entrepreneurs and remote companies',
  },
  {
    label: 'Immigration',
    href: '/immigration',
    description: 'Visas, residence permits, and paperless border administration',
  },
  {
    label: 'Development',
    href: '/development',
    children: [
      {
        group: 'Territories & Urban Masterplan',
        items: [
          { title: 'Antioch (Federal District)', href: '/development#antioch', desc: 'The concentric capital city and hexagonal ledger center', status: 'Planned' },
          { title: 'St. Barbara State', href: '/development#barbara', desc: 'Aerospace, defence, and secure maritime installations', status: 'Planned' },
          { title: 'Augustine State', href: '/development#augustine', desc: 'Medicine, universities, research, and civic life', status: 'Planned' },
          { title: 'Benedict State', href: '/development#benedict', desc: 'Energy, clean manufacturing, agriculture, and desalinisation', status: 'Planned' },
          { title: 'St. Brendan State', href: '/development#brendan', desc: 'Deepwater container port, maritime trade, and ferry hub', status: 'Planned' },
        ],
      },
      {
        group: 'Infrastructure & Engineering',
        items: [
          { title: 'Interactive Development Map', href: '/development#map', desc: 'GIS-ready spatial plan and territorial zones', status: 'Under Development' },
          { title: 'Sovereign Energy Grid', href: '/energy', desc: 'Offshore wind, nuclear small modular reactors, and hydrogen' },
          { title: 'Maritime Platforms & Ports', href: '/infrastructure', desc: 'Oceanic engineering and resilient North Sea civil structures' },
        ],
      },
    ],
  },
  {
    label: 'Economy',
    href: '/economy',
    children: [
      {
        group: 'Monetary Architecture',
        items: [
          { title: 'Treasury & Endowment', href: '/treasury', desc: 'Tax-free revenue model, public receipts, and sovereign reserves' },
          { title: 'Central Bank & Reserve', href: '/central-bank', desc: 'Monetary Board, reserve invariants, and settlement policies' },
          { title: 'The Aletheian Guilder (AEY)', href: '/aey', desc: 'The sovereign unit of account backed by provable 100% reserves' },
          { title: 'Aletheia StableChain', href: '/stablechain', desc: 'Cryptographic ledger infrastructure (500ms slots, zero gas volatility)', status: 'Under Development' },
        ],
      },
      {
        group: 'Enterprise & Capital',
        items: [
          { title: 'Business Platform', href: '/business', desc: '15-minute digital incorporation and commercial licensing' },
          { title: 'Sovereign Investment', href: '/invest', desc: 'Sovereign development bonds, infrastructure funds, and partnerships' },
        ],
      },
    ],
  },
  {
    label: 'Security & ADSS',
    href: '/adss',
    children: [
      {
        group: 'Unified Defence & Security',
        items: [
          { title: 'ADSS Directorate Overview', href: '/adss', desc: 'Single unified service with civilian oversight' },
          { title: 'Navy & Coast Guard', href: '/adss#navy', desc: 'Territorial water sovereignty, search and rescue, sector patrols' },
          { title: 'Police Directorate', href: '/adss#police', desc: 'Civilian community policing and lawful order (distinct from military)' },
          { title: 'Immigration Directorate', href: '/adss#immigration', desc: 'Border administration, biometric verification, compliance' },
        ],
      },
      {
        group: 'Critical National Resilience',
        items: [
          { title: 'Aletheian Cybersecurity Dept.', href: '/adss/cybersecurity', desc: 'Mandatory national cyber defence, validator protection, CERT/CSIRT', status: 'Operational' },
          { title: 'Emergency & Civil Protection', href: '/adss#emergency', desc: 'Disaster mitigation, maritime rescue, emergency networks' },
          { title: 'Intelligence Oversight', href: '/adss#intelligence', desc: 'Strategic situational awareness strictly bounded by privacy statute' },
        ],
      },
    ],
  },
];
