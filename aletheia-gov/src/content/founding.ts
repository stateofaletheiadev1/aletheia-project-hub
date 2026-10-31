import type { InstitutionalStatus } from "@/lib/status";

// Structural copy for /founding-programme and /government. Listed in docs/content-review.md.

export const foundingNotice =
  "The Government of Aletheia is a founding government-in-formation. Aletheia does not currently hold recognized territory or international recognition. Institutions described here are proposed or in formation unless marked Operational.";

export type Phase = { numeral: string; name: string; status: InstitutionalStatus; aim: string; work: string[] };

export const phases: Phase[] = [
  {
    numeral: "I",
    name: "Charter",
    status: "in_development",
    aim: "Write down what the State is, what its institutions may do, and what they may not.",
    work: ["Draft constitution and institutional framework", "Status taxonomy for every institution and programme", "Rules for the public record"],
  },
  {
    numeral: "II",
    name: "Infrastructure",
    status: "in_development",
    aim: "Build the systems institutions will run on, before the institutions exist.",
    work: ["AletheiaChain", "AletheiaDB", "This government platform and its workbench"],
  },
  {
    numeral: "III",
    name: "People",
    status: "planned",
    aim: "Recruit founding contributors in the open, with every appointment published.",
    work: ["Founding roles published with references", "Open applications and published criteria", "A public register of appointments"],
  },
  {
    numeral: "IV",
    name: "Economy",
    status: "planned",
    aim: "Prepare the monetary and fiscal rules: issuance kept apart from spending.",
    work: ["Issuance rules for the Aletheian Guilder", "Treasury reporting standards", "Procurement rules"],
  },
  {
    numeral: "V",
    name: "Place",
    status: "proposed",
    aim: "Seek a home for the State by lawful means only. No territory is held or claimed today.",
    work: ["Legal and diplomatic groundwork", "Site studies, published as conceptual work only"],
  },
];

export const principles: { title: string; text: string }[] = [
  {
    title: "Truth before ambition",
    text: "Every institution and programme carries its real status. An honest empty page is better than a convincing one.",
  },
  {
    title: "Record before power",
    text: "Nothing the government does is real until it is published with a reference anyone can cite.",
  },
  {
    title: "Money apart from budget",
    text: "The body that issues the Guilder is not the body that spends it.",
  },
  {
    title: "Two keys for every privileged act",
    text: "Appointments, decisions and finance records need a second, different approver.",
  },
  {
    title: "Open record, private people",
    text: "Public records are public. Personal data is encrypted before it is stored and can be erased.",
  },
];
