// The registers of the public record, mirrored one-to-one (brief §13.1, §18.3). Reference type
// codes and portal collections are the portal's own (aletheia-gov/src/lib/references.ts and
// src/server/records/public-records.ts), verified during discovery.

export const REGISTERS = ["documents", "decisions", "dispatches", "finance", "appointments", "opportunities", "events"] as const;
export type Register = (typeof REGISTERS)[number];

export type RegisterInfo = {
  label: string;
  /** Singular noun for buttons: "Approve decision". */
  noun: string;
  referenceType: "DOC" | "DEC" | "DSP" | "FIN" | "APT" | "OPP" | "EVT";
  /** Path of the register on aletheiagov.org. */
  publicPath: string;
  /** What the register holds, in the portal's words. */
  description: string;
  /** The rule stated publicly, shown beside the register and in empty states. */
  publicationRule: string;
  /** Empty-state sentence, in the portal's voice. */
  emptyText: string;
};

export const REGISTER: Record<Register, RegisterInfo> = {
  documents: {
    label: "Documents",
    noun: "document",
    referenceType: "DOC",
    publicPath: "/documents",
    description: "Founding texts, frameworks, specifications and reports.",
    publicationRule: "Every version is kept, and every published version carries a SHA-256 content hash. An author cannot approve their own document.",
    emptyText: "No documents yet. The founding framework will be drafted, reviewed and published here as versioned documents.",
  },
  decisions: {
    label: "Decisions",
    noun: "decision",
    referenceType: "DEC",
    publicPath: "/decisions",
    description: "Adopted institutional decisions.",
    publicationRule: "Published only once adopted and approved by a second officer.",
    emptyText: "No decisions yet. Decisions are published only once adopted and approved by a second officer.",
  },
  dispatches: {
    label: "Dispatches",
    noun: "dispatch",
    referenceType: "DSP",
    publicPath: "/dispatches",
    description: "Announcements and notices.",
    publicationRule: "One reviewer and a publishing officer.",
    emptyText: "No dispatches yet. Announcements and notices are reviewed once and released by a publishing officer.",
  },
  finance: {
    label: "Public finance",
    noun: "finance record",
    referenceType: "FIN",
    publicPath: "/public-finance",
    description: "Budgets, receipts, expenditure and reports.",
    publicationRule: "Each item is traced to a source document and approved by a finance officer. Restricted until publication is authorised.",
    emptyText: "No finance records yet. Each one will be traced to a source document before it can be submitted.",
  },
  appointments: {
    label: "Appointments",
    noun: "appointment",
    referenceType: "APT",
    publicPath: "/appointments",
    description: "Verified appointments only.",
    publicationRule: "Verified by an officer other than the drafter. Personal details are published only with explicit authorisation.",
    emptyText: "No appointments yet. Only verified appointments are published.",
  },
  opportunities: {
    label: "Opportunities",
    noun: "opportunity",
    referenceType: "OPP",
    publicPath: "/opportunities",
    description: "Positions with reference, mandate and selection criteria; applications.",
    publicationRule: "Applications are reviewed by two people and are never published.",
    emptyText: "No opportunities yet. Positions are published with their mandate and selection criteria.",
  },
  events: {
    label: "Events",
    noun: "event",
    referenceType: "EVT",
    publicPath: "/events",
    description: "Public sessions and meetings.",
    publicationRule: "Times are shown in the event's own timezone. Changes and cancellations are published as amendments.",
    emptyText: "No events yet. Public sessions and meetings will be announced here.",
  },
};

export function isRegister(value: string): value is Register {
  return (REGISTERS as readonly string[]).includes(value);
}

/** AGV-{TYPE}-{YEAR}-{SEQ}, sequence zero-padded to at least four digits (portal format). */
export function formatReference(type: RegisterInfo["referenceType"], year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new RangeError("year out of range");
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError("sequence must be a positive integer");
  return `AGV-${type}-${year}-${String(seq).padStart(4, "0")}`;
}

const REFERENCE = /^AGV-(DOC|DEC|DSP|FIN|APT|OPP|EVT)-(\d{4})-(\d{4,})$/;
export function parseReference(ref: string): { type: RegisterInfo["referenceType"]; year: number; seq: number } | null {
  const m = REFERENCE.exec(ref.trim().toUpperCase());
  if (!m) return null;
  return { type: m[1] as RegisterInfo["referenceType"], year: Number(m[2]), seq: Number(m[3]) };
}

/** The placeholder the portal shows in empty registers. */
export function placeholderReference(type: RegisterInfo["referenceType"]): string {
  return `AGV-${type}-····-····`;
}
