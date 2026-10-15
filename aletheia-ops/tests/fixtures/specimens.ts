// Specimen content for the /design review route and visual tests (brief §16). Every person,
// figure and reference here is FICTIONAL and exists only to test layouts with realistic length:
// long names with diacritics, 200-character titles, every status and every classification.
// Never written to a database, never shown outside /design, never deployed as content.

import type { Classification, Priority, RecordState } from "@/domain/glossary";
import type { Register } from "@/domain/registers";
import type { Actor } from "@/policy/roles";

export const SPECIMEN_NOTICE = "Specimen content. Every name, reference and figure on this page is fictional and exists to test the design.";

export const specimenNow = new Date("2026-10-15T14:42:00Z");

export const specimenOfficial = { name: "Adaeze Okonkwo-Fairweather", role: "Approving officer", institution: "Treasury and Public Finance" };

export const specimenActor: Actor = {
  id: "specimen-official",
  state: "active",
  mfa: true,
  grants: [
    { role: "approving_officer", institution: "treasury", clearance: "restricted" },
    { role: "approving_officer", institution: "council-of-the-states", clearance: "internal" },
    { role: "author", institution: "treasury", clearance: "restricted" },
    { role: "auditor", institution: "*", clearance: "internal" },
    { role: "government_administrator", institution: "*", clearance: "internal" },
    { role: "publishing_officer", institution: "*", clearance: "public" },
  ],
};

export type SpecimenRow = {
  id: string;
  reference: string;
  register: Register;
  title: string;
  institution: string;
  state: RecordState;
  classification: Classification;
  priority: Priority;
  assignee: string;
  updatedAt: string;
  dueAt?: string;
  isNew?: boolean;
};

const H = (h: number) => new Date(specimenNow.getTime() - h * 3_600_000).toISOString();
const D = (d: number) => new Date(specimenNow.getTime() + d * 86_400_000).toISOString();

export const specimenRows: SpecimenRow[] = [
  {
    id: "s1",
    reference: "AGV-DEC-····-····",
    register: "decisions",
    title: "Decision on the interim rules of procedure for the Council of the States during the founding period, including quorum, the order of business and the publication of minutes",
    institution: "Council of the States",
    state: "adopted",
    classification: "public",
    priority: "priority",
    assignee: "Adaeze Okonkwo-Fairweather",
    updatedAt: H(0.3),
    dueAt: D(2),
    isNew: true,
  },
  {
    id: "s2",
    reference: "AGV-FIN-····-····",
    register: "finance",
    title: "Founding period budget statement, first quarter",
    institution: "Treasury and Public Finance",
    state: "under_review",
    classification: "restricted",
    priority: "urgent",
    assignee: "Søren Østergaard-Ekwueme",
    updatedAt: H(3),
    dueAt: D(-2),
    isNew: true,
  },
  {
    id: "s3",
    reference: "AGV-DOC-2026-0003",
    register: "documents",
    title: "The founding framework of the Data Protection and Registry Ombudsman: mandate, independence, powers of inquiry and the handling of complaints from residents and applicants",
    institution: "Data Protection and Registry Ombudsman",
    state: "published",
    classification: "public",
    priority: "routine",
    assignee: "Marie-Thérèse N’Diaye",
    updatedAt: H(26),
  },
  {
    id: "s4",
    reference: "AGV-DSP-····-····",
    register: "dispatches",
    title: "Notice of the first public session of the Covenant Assembly working group",
    institution: "The Covenant Assembly",
    state: "revision_requested",
    classification: "public",
    priority: "routine",
    assignee: "Tobias Aldridge",
    updatedAt: H(50),
    dueAt: D(5),
  },
  {
    id: "s5",
    reference: "AGV-APT-····-····",
    register: "appointments",
    title: "Appointment of the interim Registrar of the High Court",
    institution: "The High Court of Aletheia",
    state: "verified",
    classification: "internal",
    priority: "priority",
    assignee: "Ilse van der Westhuizen",
    updatedAt: H(75),
    dueAt: D(1),
  },
  {
    id: "s6",
    reference: "AGV-DOC-····-····",
    register: "documents",
    title: "Draft standing orders of the Electoral Commission",
    institution: "Electoral Commission",
    state: "draft",
    classification: "internal",
    priority: "routine",
    assignee: "Kwame Asante-Mensah",
    updatedAt: H(120),
  },
  {
    id: "s7",
    reference: "AGV-FIN-····-····",
    register: "finance",
    title: "Statement of contributions received for the founding programme",
    institution: "Treasury and Public Finance",
    state: "publication_failed",
    classification: "public",
    priority: "urgent",
    assignee: "Adaeze Okonkwo-Fairweather",
    updatedAt: H(6),
  },
  {
    id: "s8",
    reference: "AGV-EVT-····-····",
    register: "events",
    title: "Public hearing on the maritime and ports framework",
    institution: "The Chancellor and Cabinet",
    state: "rejected",
    classification: "public",
    priority: "routine",
    assignee: "Tobias Aldridge",
    updatedAt: H(200),
  },
  {
    id: "s9",
    reference: "AGV-DOC-····-····",
    register: "documents",
    title: "Memorandum on the custody of the reserve ledger keys",
    institution: "Aletheia Monetary Authority",
    state: "submitted",
    classification: "confidential",
    priority: "priority",
    assignee: "Søren Østergaard-Ekwueme",
    updatedAt: H(9),
    dueAt: D(3),
  },
];

export const specimenBody = [
  "The Council of the States, meeting in its founding session, adopts the following interim rules of procedure. They apply until the Council adopts its standing orders under the founding framework.",
  "A quorum is a majority of the members appointed at the time of the sitting. A sitting without a quorum may hear reports but may not take decisions.",
  "The order of business is published at least five days before each sitting. Minutes are published within ten days of the sitting, once approved by the presiding member.",
];

export const specimenBodyPrevious = [
  "The Council of the States, meeting in its founding session, adopts the following interim rules of procedure.",
  "A quorum is one third of the members appointed at the time of the sitting. A sitting without a quorum may hear reports but may not take decisions.",
  "The order of business is published at least five days before each sitting.",
];
