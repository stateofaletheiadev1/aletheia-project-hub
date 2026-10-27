import { STABLECHAIN } from '@/lib/stablechain';
import type { AssetKey, ManualStatus } from '@/lib/status';

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
      /** A national asset: the badge comes from the status register. */
      asset?: AssetKey;
      status?: ManualStatus;
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
          { title: 'National Symbols', href: '/identity', desc: 'Coat of arms, the Star of Truth, flags and the travel-document design' },
          { title: 'Status & Disclaimers', href: '/transparency', desc: 'The status register, disclaimers and the public record', asset: 'platform' },
        ],
      },
      {
        group: 'The Founding Project',
        items: [
          { title: 'Founding Team', href: '/about', desc: 'Who is building Aletheia, and how to reach them' },
          { title: 'Roadmap', href: '/roadmap', desc: 'An honest path, phase by phase, to a pilot platform' },
          { title: 'Founding Thesis', href: '/thesis', desc: 'Legal structure, governance, economics and diplomacy' },
        ],
      },
      {
        group: 'Communications',
        items: [
          { title: 'Gazette & News', href: '/news', desc: 'Founding-phase records, design studies and statements' },
          { title: 'Public Documents', href: '/documents', desc: 'The draft Covenant, proposed Acts and APS protocol standards' },
          { title: 'Contact', href: '/contact', desc: 'Press enquiries, partnerships and general contact' },
          { title: 'Questions & Answers', href: '/faq', desc: 'Plain answers on membership, money, data, and status' },
        ],
      },
      {
        group: 'Society & Public Services',
        items: [
          { title: 'Life in Aletheia', href: '/society', desc: 'Languages, culture, the civic calendar, and maritime heritage' },
          { title: 'Health & Social Care', href: '/healthcare', desc: 'The proposed covenant healthcare model', status: 'Planned' },
          { title: 'Education & Research', href: '/education', desc: 'Proposed schools, a National University and research grants', status: 'Planned' },
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
          { title: 'The Constitution', href: '/constitution', desc: 'The draft Covenant: searchable articles, permalinks and diffs', asset: 'constitution' },
          { title: 'The Covenant Assembly', href: '/government#assembly', desc: 'A proposed 61-member parliament elected by PR', asset: 'institutions' },
          { title: 'Council of States', href: '/government#council', desc: 'A proposed 15-member territorial review chamber', asset: 'institutions' },
          { title: 'The Chancellor & Cabinet', href: '/government#cabinet', desc: 'A proposed executive capped at nine ministries', asset: 'institutions' },
          { title: 'The Judiciary & High Court', href: '/government#judiciary', desc: 'Proposed constitutional, civil and dispute-resolution courts', asset: 'institutions' },
        ],
      },
      {
        group: 'The Nine Ministries',
        items: [
          { title: 'Treasury & Finance', href: '/treasury', desc: 'The Covenant Endowment design and public balance-sheet model' },
          { title: 'Digital State & Registries', href: '/technology', desc: 'StableChain Mainnet Beta, digital identity design and registries' },
          { title: 'Resilience & Civil Protection', href: '/security', desc: 'Planned civil oversight of resilience and cyber protection' },
          { title: 'Foreign Affairs & Justice', href: '/government/ministry-of-foreign-affairs', desc: 'Diplomatic relations, treaties and the travel-document design' },
          { title: 'All Ministries Directory', href: '/government', desc: 'The proposed ministries and their mandates' },
        ],
      },
    ],
  },
  {
    label: 'Citizenship',
    href: '/citizenship',
    description: 'Membership by covenant: proposed rights, obligations and naturalisation',
    children: [
      {
        group: 'Membership by Covenant',
        items: [
          { title: 'Citizenship Standards', href: '/citizenship', desc: 'Proposed rights, obligations and the paths to citizenship', asset: 'citizenship' },
          { title: 'Become a Founding Member', href: '/founding-members', desc: 'Register interest. Free; nothing is sold' },
          { title: 'Travel Document Design', href: '/design/travel-document', desc: 'A design concept, not a travel document', status: 'Proposed' },
        ],
      },
      {
        group: 'The National Register',
        items: [
          { title: 'The Founding Register', href: '/registry', desc: 'How the register is designed, and the public record' },
          { title: 'E-Residency', href: '/e-residency', desc: 'Proposed digital access for global founders', asset: 'eResidency' },
          { title: 'Immigration & Residence', href: '/immigration', desc: 'Proposed residence permits, within a future territory', asset: 'residence' },
        ],
      },
    ],
  },
  {
    label: 'E-Residency',
    href: '/e-residency',
    description: 'Proposed digital access for global entrepreneurs and remote companies',
  },
  {
    label: 'Immigration',
    href: '/immigration',
    description: 'Proposed visas and residence permits, within a future territory',
  },
  {
    label: 'Development',
    href: '/development',
    children: [
      {
        group: 'Territory & Design Studies',
        items: [
          { title: 'The Seastead', href: '/development#seastead', desc: 'A territory at sea that Aletheia builds and owns', asset: 'territory' },
          { title: 'Antioch (Federal District)', href: '/development#antioch', desc: 'Design study for a concentric capital city', asset: 'antioch' },
          { title: 'St. Barbara State', href: '/development#barbara', desc: 'Aerospace, engineering and civil-protection functions', asset: 'antioch' },
          { title: 'Augustine State', href: '/development#augustine', desc: 'Medicine, universities, research, and civic life', asset: 'antioch' },
          { title: 'Benedict State', href: '/development#benedict', desc: 'Energy, clean manufacturing, agriculture, and desalination', asset: 'antioch' },
          { title: 'St. Brendan State', href: '/development#brendan', desc: 'Deepwater port, maritime trade, and ferry hub', asset: 'antioch' },
        ],
      },
      {
        group: 'Infrastructure & Engineering',
        items: [
          { title: 'Development Map', href: '/development#map', desc: 'A design-study map; to be built at sea', status: 'Vision' },
          { title: 'Clean Energy', href: '/energy', desc: 'Offshore wind, small modular reactors and hydrogen: design studies', status: 'Vision' },
          { title: 'Ports & Coastal Works', href: '/infrastructure', desc: 'Port and coastal engineering design studies', asset: 'maritime' },
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
          { title: 'Treasury & Endowment', href: '/treasury', desc: 'Proposed revenue model and public receipts' },
          { title: 'Reserve Bank of Aletheia', href: '/central-bank', desc: 'The proposed monetary institution', asset: 'reserveBank' },
          { title: 'The Aletheian Guilder (AEY)', href: '/aey', desc: 'The proposed national currency. Not issued to the public', asset: 'aey' },
          { title: 'AEY Paper Currency', href: '/aey/paper-currency', desc: 'Banknote design concepts, 1 to 100 AEY', status: 'Proposed' },
          { title: 'Aletheia StableChain', href: '/stablechain', desc: 'Mainnet Beta ledger infrastructure (500 ms slots, fixed fee schedule)', asset: 'stablechain' },
          ...(STABLECHAIN.explorerLive ? [{ title: 'StableChain Explorer', href: STABLECHAIN.explorer, desc: 'Blocks, transactions and accounts on Mainnet Beta', asset: 'stablechain' as const }] : []),
        ],
      },
      {
        group: 'Enterprise & Capital',
        items: [
          { title: 'Business Platform', href: '/business', desc: 'Proposed digital incorporation and licensing', status: 'Planned' },
          { title: 'Investment & Partnerships', href: '/invest', desc: 'How future partners and investors could take part. Nothing is offered' },
        ],
      },
    ],
  },
  {
    label: 'Resilience',
    href: '/adss',
    children: [
      {
        group: 'Civil Protection & Resilience',
        items: [
          { title: 'Resilience Overview', href: '/adss', desc: 'Planned civil-protection functions under civilian oversight', status: 'Planned' },
          { title: 'Coastguard & Rescue', href: '/adss#navy', desc: 'Planned search and rescue and coastal safety', status: 'Planned' },
          { title: 'Police Directorate', href: '/adss#police', desc: 'Planned civilian policing, separate from any other service', asset: 'police' },
          { title: 'Immigration Directorate', href: '/adss#immigration', desc: 'Planned border administration and residence permits', asset: 'immigration' },
        ],
      },
      {
        group: 'Digital & Civil Resilience',
        items: [
          { title: 'Aletheian Cybersecurity Dept.', href: '/adss/cybersecurity', desc: 'A planned department to protect digital infrastructure', asset: 'cyber' },
          { title: 'Emergency & Civil Protection', href: '/adss#emergency', desc: 'Planned disaster response and maritime rescue', status: 'Planned' },
          { title: 'Independent Oversight', href: '/adss#intelligence', desc: 'Proposed oversight of every security function, bounded by privacy law', status: 'Proposed' },
        ],
      },
    ],
  },
];
