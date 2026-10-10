// Loads demonstration records so the public record can be seen working (brief §19).
// Every record carries demo: true and is shown with a "Demonstration data" label.
// Refuses to run against any database whose name does not end in "_demo", so it can
// never write into the real public record.
//   ALETHEIADB_URL=aletheiadb://<id>:<secret>@db.stateofaletheia.org/gov_demo node scripts/seed-demo.mjs
import { AletheiaDB, ConflictError } from "@aletheia/aletheiadb";

const url = process.env.ALETHEIADB_URL;
const client = url ? AletheiaDB.connect(url) : null;
const name = client?.options.database ?? "";
if (!client || !name.endsWith("_demo")) {
  console.error(`Refusing to seed: the target database must end in "_demo" (got "${name || "none"}").`);
  process.exit(2);
}
if (process.env.APP_ENV === "production") {
  console.error("Refusing to seed: APP_ENV is production.");
  process.exit(2);
}
const db = client.db();
const year = new Date().getUTCFullYear();

async function nextRef(type) {
  const counters = db.collection("counters");
  const key = `ref:${type}:${year}`;
  for (let i = 0; i < 8; i++) {
    const c = await counters.findOne({ name: key });
    try {
      if (!c) {
        await counters.insertOne({ name: key, value: 1 });
        return `AGV-${type}-${year}-0001`;
      }
      const n = await counters.updateOne(c._id, c._rev, { $inc: { value: 1 } });
      return `AGV-${type}-${year}-${String(n.value).padStart(4, "0")}`;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new Error("reference allocation failed");
}

const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const p = (text) => ({ type: "paragraph", text });

const RECORDS = [
  ["documents", "DOC", {
    slug: "founding-framework-summary-demo", title: "Founding framework: summary of the draft", issuer: "The Founding Government", status: "Published, version 1",
    summary: "A plain-language summary of the draft institutional framework, as a versioned document.",
    facts: [{ label: "Version", value: "1.0" }, { label: "Language", value: "English" }, { label: "Content hash (SHA-256)", value: "demo-0f3a…c91e" }],
    body: [p("This demonstration document shows how a founding text appears on the public record: an official reference, the issuing body, its version and content hash in the margin, and structured text."), { type: "heading", text: "What the framework sets out" }, { type: "list", items: ["A legislature, a territorial review chamber and an executive capped at nine ministries", "Independent bodies: Auditor-General, Monetary Authority, Electoral Commission, Ombudsman", "A status for every institution, from proposed to operational"] }],
  }, 12],
  ["documents", "DOC", {
    slug: "public-record-rules-demo", title: "Rules for the public record", issuer: "The Founding Government", status: "Published, version 1",
    summary: "How records are referenced, approved, published, amended and withdrawn.",
    facts: [{ label: "Version", value: "1.0" }, { label: "Language", value: "English" }],
    body: [p("Every public record carries a reference in the form AGV-TYPE-YEAR-NUMBER, fixed for good once issued."), p("Decisions, appointments and finance records need a second, different authorised officer before they are published.")],
  }, 6],
  ["decisions", "DEC", {
    slug: "adoption-of-status-taxonomy-demo", title: "Adoption of the institutional status taxonomy", issuer: "The Founding Government", status: "Adopted",
    summary: "Every institution and programme carries exactly one of nine published statuses.",
    facts: [{ label: "Decision date", value: daysAgo(9).slice(0, 10) }, { label: "Approvals", value: "2 officers (demonstration)" }],
    body: [p("The founding government adopts nine statuses: proposed, planned, in formation, in development, recruiting, established, operational, suspended and archived."), p("No institution may be marked operational without evidence on the record and a second approver.")],
  }, 9],
  ["dispatches", "DSP", {
    slug: "public-record-opens-demo", title: "The public record is connected", issuer: "The Founding Government",
    summary: "aletheiagov.org now reads its registers from AletheiaDB, the State's own database.",
    body: [p("From today, documents, decisions, dispatches and finance records published by the founding government appear on this site directly from AletheiaDB."), { type: "quote", text: "Nothing is real until it is published.", source: "Principle of the public record" }],
  }, 1],
  ["dispatches", "DSP", {
    slug: "register-your-interest-demo", title: "Registering interest in proposed institutions", issuer: "The Founding Government",
    summary: "People can now register interest in the institutions being founded. Personal details are encrypted before storage.",
    body: [p("Each proposed institution's page now has a form to register interest. Names, emails and notes are encrypted under a key held only by the server."), p("Registering interest is not an application and confers no role.")],
  }, 0],
  ["opportunities", "OPP", {
    slug: "monetary-economist-demo", title: "Founding monetary economist", issuer: "Aletheia Monetary Authority (proposed)", status: "Open",
    summary: "Draft the issuance rules and reserve invariants for the Aletheian Guilder.",
    facts: [{ label: "Commitment", value: "Part-time, remote" }, { label: "Compensation", value: "Voluntary founding role" }, { label: "Closes", value: daysAgo(-30).slice(0, 10) }],
    body: [{ type: "heading", text: "Responsibilities" }, { type: "list", items: ["Draft the AEY issuance rules", "Specify the reserve invariants and how they are reported", "Review the StableChain monetary layer"] }, { type: "heading", text: "Qualifications" }, { type: "list", items: ["Advanced degree in economics or finance", "Experience with monetary or payment systems"] }],
  }, 3],
  ["finance", "FIN", {
    slug: "platform-hosting-costs-demo", title: "Expenditure: platform hosting, Q4", issuer: "Treasury and Public Finance (proposed)", status: "Published",
    summary: "Sum of 1 published expenditure record, period Q4 " + year + ".",
    facts: [{ label: "Amount", value: "EUR 0.00" }, { label: "Period", value: `Q4 ${year}` }, { label: "Basis", value: "Always Free cloud resources" }],
    body: [p("Shows how a finance record is presented: currency, period, basis and source. Amounts are stored as whole numbers of the smallest currency unit.")],
  }, 4],
  ["events", "EVT", {
    slug: "public-briefing-demo", title: "Public briefing on the founding programme", issuer: "The Founding Government", status: "Scheduled",
    summary: "An online briefing on phases I and II of the founding programme.",
    facts: [{ label: "Date", value: daysAgo(-21).slice(0, 10) }, { label: "Time", value: "16:00 UTC" }, { label: "Format", value: "Online" }],
    body: [p("A demonstration event record: date with time zone, format, and the record it will produce.")],
  }, 2],
];

let created = 0;
for (const [collection, type, record, age] of RECORDS) {
  const c = db.collection(collection);
  if (await c.findOne({ slug: record.slug })) {
    console.log(`  exists  ${collection}/${record.slug}`);
    continue;
  }
  const reference = await nextRef(type);
  await c.insertOne({ ...record, reference, visibility: "public", publication: { state: "published", publishedAt: daysAgo(age) }, demo: true, schemaVersion: 1 });
  console.log(`  created ${reference}  ${collection}/${record.slug}`);
  created++;
}
console.log(`seed: ${created} demonstration record(s) created in ${name}`);
