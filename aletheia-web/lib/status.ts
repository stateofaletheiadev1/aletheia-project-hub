/**
 * ALETHEIA STATUS TAXONOMY (Strict Enforcement per §3.1)
 * Every institution, service, project, law, infrastructure and capability
 * carries exactly one status.
 */

export type NationalStatus = 
  | 'Operational' 
  | 'Under Development' 
  | 'Planned' 
  | 'Proposed' 
  | 'Vision';

export interface StatusMeta {
  status: NationalStatus;
  description: string;
  badgeClass: string;
  dotColor: string;
}

export const STATUS_CONFIG: Record<NationalStatus, StatusMeta> = {
  'Operational': {
    status: 'Operational',
    description: 'Actually functioning and provable today.',
    badgeClass: 'bg-[#EAF6EE] text-[#1B5E38] border-[#9AD6AF]',
    dotColor: '#1B5E38',
  },
  'Under Development': {
    status: 'Under Development',
    description: 'Currently in active engineering or construction.',
    badgeClass: 'bg-[#FDF6E2] text-[#8F5800] border-[#ECC974]',
    dotColor: '#C49A4E',
  },
  'Planned': {
    status: 'Planned',
    description: 'Approved or scheduled in the national roadmap.',
    badgeClass: 'bg-[#EBF3FB] text-[#1A4A7A] border-[#9DC3EA]',
    dotColor: '#1A4A7A',
  },
  'Proposed': {
    status: 'Proposed',
    description: 'Formulated policy or design proposal awaiting constitutional sanction.',
    badgeClass: 'bg-[#F5EFFD] text-[#583688] border-[#CBB2EC]',
    dotColor: '#583688',
  },
  'Vision': {
    status: 'Vision',
    description: 'Long-term conceptual and architectural horizon (2030–2045).',
    badgeClass: 'bg-[#F0F2F5] text-[#4A5568] border-[#CBD5E0]',
    dotColor: '#718096',
  },
};
