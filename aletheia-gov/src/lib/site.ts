export const site = {
  name: "The Government of Aletheia",
  officialName: "Sovereign Covenant State of Aletheia",
  commonName: "Aletheia",
  url: "https://aletheiagov.org",
  nationalSite: "https://stateofaletheia.org",
  contact: { general: "info@stateofaletheia.org", press: "press@stateofaletheia.org", security: "security@aletheiagov.org" },
  capital: "Antioch",
  motto: { latin: "Veritas in Foedere", english: "Truth in Covenant" },
  principle: "Build the institutional operating system before the physical state.",
  description:
    "The founding government of the Sovereign Covenant State of Aletheia: its institutions in formation, programmes, opportunities and public record.",
} as const;

export type NavLink = { href: string; label: string; note?: string };

export const primaryNav: NavLink[] = [
  { href: "/government", label: "Government" },
  { href: "/institutions", label: "Institutions" },
  { href: "/projects", label: "Programmes" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/documents", label: "Documents" },
];

export const recordNav: NavLink[] = [
  { href: "/decisions", label: "Decisions", note: "Adopted institutional decisions" },
  { href: "/dispatches", label: "Dispatches", note: "Announcements and notices" },
  { href: "/public-finance", label: "Public Finance", note: "Budgets, receipts, reports" },
  { href: "/appointments", label: "Appointments", note: "Verified appointments only" },
  { href: "/directory", label: "Directory", note: "Institutions and positions" },
  { href: "/events", label: "Events", note: "Public sessions and meetings" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "The Government",
    links: [
      { href: "/government", label: "The founding government" },
      { href: "/institutions", label: "Institutional framework" },
      { href: "/founding-programme", label: "Founding programme" },
      { href: "/development", label: "Development framework" },
    ],
  },
  {
    title: "The Record",
    links: [
      { href: "/documents", label: "Documents" },
      { href: "/decisions", label: "Decisions" },
      { href: "/dispatches", label: "Dispatches" },
      { href: "/public-finance", label: "Public finance" },
      { href: "/appointments", label: "Appointments" },
      { href: "/directory", label: "Directory" },
    ],
  },
  {
    title: "Take Part",
    links: [
      { href: "/opportunities", label: "Opportunities" },
      { href: "/build-aletheia", label: "Build Aletheia" },
      { href: "/projects", label: "Programmes" },
      { href: "/events", label: "Events" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "This Website",
    links: [
      { href: "/search", label: "Search the record" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms of use" },
      { href: "/accessibility", label: "Accessibility" },
      { href: "/image-credits", label: "Image credits" },
    ],
  },
];
