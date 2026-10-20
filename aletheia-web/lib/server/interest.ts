import 'server-only';
import { randomUUID } from 'node:crypto';
import { ConflictError } from '@aletheia/aletheiadb';
import { collection } from './db';
import { blindIndex, sealFields, type Sealed } from './envelope';

// Founding-member interest: name, email, country and an optional note, nothing else. No
// identity documents, no payment. Personal fields are sealed under a per-registration key,
// so `npm run erase-person` style shredding works the same way as for accounts.

export const CONSENT_VERSION = '2026-10-20';

export type InterestRegistration = {
  subject: string;
  /** Blind index of the email, so a second registration with the same address is recognised. */
  emailIndex: string;
  pii: Sealed;
  consentVersion: string;
  createdAt: string;
};

export const interest = () => collection<InterestRegistration>('founding_interest');

/** Records a registration. Registering the same email twice is not an error: the first stands. */
export async function registerInterest(fields: { name: string; email: string; country: string; contribution: string }): Promise<'created' | 'exists'> {
  const emailIndex = blindIndex('interest-email', fields.email);
  if (await interest().findOne({ emailIndex })) return 'exists';
  const subject = `interest:${randomUUID()}`;
  try {
    await interest().insertOne({
      subject,
      emailIndex,
      pii: await sealFields(subject, fields, 'founding-interest'),
      consentVersion: CONSENT_VERSION,
      createdAt: new Date().toISOString(),
    });
    return 'created';
  } catch (e) {
    if (e instanceof ConflictError) return 'exists';
    throw e;
  }
}
