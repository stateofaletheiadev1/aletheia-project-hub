import 'server-only';
import { renderLetter } from './mail-letter';

// Letters to founding members and to the founding team (layout in mail-letter.ts).

const SITE = {
  name: 'The Sovereign Covenant State of Aletheia',
  url: 'https://stateofaletheia.org',
  host: 'stateofaletheia.org',
  arms: 'https://www.stateofaletheia.org/brand/email-arms.png',
};

export type FoundingMember = { name: string; email: string; country: string; contribution: string };

/** To the person who registered. */
export function foundingMemberWelcome(m: FoundingMember) {
  return renderLetter({
    to: m.email,
    subject: 'Welcome to the founding community of Aletheia',
    preheader: 'Your registration as a founding member has been recorded.',
    kicker: 'Founding Community',
    heading: 'Welcome to the founding community',
    greeting: `Dear ${m.name},`,
    paragraphs: [
      'Thank you for registering your interest as a founding member of the Sovereign Covenant State of Aletheia. Your registration has been recorded, and you are now among the first people helping to build a nation founded on truth, covenant and the rule of law.',
    ],
    details: {
      title: 'Your registration',
      rows: [
        ['Name', m.name],
        ['Country', m.country],
        ...(m.contribution ? ([['How you would like to help', m.contribution]] as [string, string][]) : []),
      ],
    },
    steps: {
      title: 'What happens next',
      items: [
        'We will write to you as the founding community forms, with news of the Constitution, the seastead and the first platform.',
        'When positions open in the founding government, they are published at aletheiagov.org/opportunities.',
        'Registering is free and creates no obligation. It does not confer citizenship, and nothing is ever sold.',
      ],
    },
    closing: ['You may ask us to erase your details at any time by writing to info@stateofaletheia.org.'],
    signature: { name: 'Emeka Iwuagwu', role: 'Founder, on behalf of the Founding Team' },
    site: SITE,
  });
}

/** To the founding team. */
export function foundingMemberNotice(m: FoundingMember, notify: string) {
  return renderLetter({
    to: notify,
    subject: `New founding member: ${m.name} (${m.country})`,
    preheader: `${m.name} from ${m.country} registered on stateofaletheia.org.`,
    kicker: 'Founding Community · Notice',
    heading: 'A new founding member has registered',
    greeting: 'To the Founding Team,',
    paragraphs: ['A new founding-member registration was recorded on stateofaletheia.org.'],
    details: {
      title: 'Registration',
      rows: [
        ['Name', m.name],
        ['Email', m.email],
        ['Country', m.country],
        ...(m.contribution ? ([['How they would like to help', m.contribution]] as [string, string][]) : []),
      ],
    },
    signature: { name: 'stateofaletheia.org', role: 'Automatic notice' },
    valediction: null,
    site: SITE,
  });
}
