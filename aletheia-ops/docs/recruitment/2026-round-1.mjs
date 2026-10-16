// The first recruitment round (16 October 2026): five opportunities issued by the Founding
// Government on the founder's authority. Entered and published through the workbench by
// scripts/publish-round.mjs, in the founder's own signed-in session. Texts follow the workbench
// composer conventions: "## Heading", "- item", blank lines between paragraphs.

const ABOUT = `## About Aletheia

The Sovereign Covenant State of Aletheia is a maritime republic in its founding phase, founded by Emeka Iwuagwu. Its constitution, institutions, currency and settlement are being designed now, and much of this work is research. Aletheia is not yet recognised as a state by other states and does not yet hold maritime territory; its institutions other than the Founding Government are proposed, not operating. This position is a chance to shape that work with your expertise, in the open and on the public record.`;

const TERMS = (hours) => `## Terms of the engagement

- Unpaid. There is no salary, fee or benefits package, and no promise of future payment. If a funded arrangement is ever offered, it will be separate, in writing and approved.
- Remote, part-time and flexible, open to applicants anywhere, subject to any legal restrictions that apply to you.
- About ${hours} hours a week (indicative; agreed with you before you start).
- An initial term of three months, renewable by mutual agreement.
- You report to the founder, Emeka Iwuagwu, or an official he designates.
- The position gives no employment contract, appointment to public office, citizenship, residency, diplomatic status or authority to act or commit on behalf of Aletheia.`;

const APPLY = `## How to apply

Use the "Apply for this position" button on this page. You will be asked for:

- Your CV or professional profile, as a PDF of up to 2 MB.
- In "What would you bring?" (up to 1,000 characters): a short motivation statement, your weekly availability, and links to relevant work, such as publications, reports, code or a professional profile.

We collect only what is needed to assess your application: your name, email, areas of interest, expertise and CV. Applications are encrypted, read only by authorised officials, and deleted after twelve months unless you are taken on.

## How applications are assessed

Applications are assessed against what this listing asks for: relevant experience, the quality of work you can show, your motivation, your availability, how clearly you communicate, and the role's specific competences. Shortlisted applicants are invited by email to a conversation. Qualified applicants are welcome regardless of background, nationality, gender, religion or any characteristic that has no bearing on the work.`;

const FACTS = (area, hours) => `Functional area: ${area}
Engagement: Unpaid, remote, part-time
Time commitment: About ${hours} hours a week
Initial term: Three months, renewable
Reports to: The founder, Emeka Iwuagwu
Issued by: Emeka Iwuagwu, Founder`;

export const ROUND = [
  {
    key: "A",
    expected: "AGV-OPP-2026-0001",
    title: "Monetary and Financial Systems Adviser",
    positionType: "advisory",
    hours: "5 to 8",
    area: "Monetary and financial systems",
    summary:
      "Help design Aletheia's monetary and financial framework: the Aletheian Guilder (AEY), the proposed Aletheia Monetary Authority, reserves, redemption, payments and financial risk controls. Advisory, unpaid, remote.",
    body: `## Why this position exists

A currency is only as trustworthy as the institutions, reserves and rules behind it. Aletheia intends its currency, the Aletheian Guilder (AEY), to be issued under a proposed Aletheia Monetary Authority, with a reference rate of 1 AEY to 1 EUR, and recorded on the Aletheia StableChain alongside a planned banknote series. Before any of that can be relied on, the framework has to be researched, tested and written down by people who know how monetary systems succeed and fail.

## What you will do

- Research suitable structures for a monetary authority and for reserve management.
- Assess the feasibility and risks of the proposed reference rate of 1 AEY to 1 EUR.
- Draft a preliminary framework for reserve sufficiency, custody, liquidity, redemption and independent verification.
- Identify the banking, payments, financial-services, anti-money-laundering and consumer-protection requirements that would apply.
- Evaluate how StableChain-based AEY units should relate to any future physical banknotes.
- Keep a risk register of technical, monetary, legal and operational risks.
- Recommend governance, segregation of duties, reporting and independent oversight.
- Write research memoranda and recommendations for the founder and for future qualified officials of the Monetary Authority.

## What you will deliver in the first term

- A memorandum on monetary architecture and feasibility.
- A preliminary reserve and redemption framework.
- A financial and regulatory risk register.
- Recommendations for further specialist appointments and independent review.

## Who we are looking for

Experience in central banking, monetary economics, banking operations, treasury, payment systems, financial regulation, risk management or reserve administration. A relevant degree is welcome; substantial relevant professional experience counts equally.

## Limits of the role

This is a research and advisory position. It does not authorise you to issue currency, operate a bank, take deposits, promise redemption, state that reserves exist, or make financial commitments on behalf of Aletheia. The work does not assume that reserve backing or redemption arrangements are in place; establishing what they would require is part of the task.`,
  },
  {
    key: "B",
    expected: "AGV-OPP-2026-0002",
    title: "Constitutional and Maritime Law Research Adviser",
    positionType: "advisory",
    hours: "5 to 8",
    area: "Constitutional development and legal research",
    summary:
      "Research the constitutional, international and maritime law questions that shape Aletheia's founding: statehood, the law of the sea, seasteading and offshore infrastructure. Advisory, unpaid, remote.",
    body: `## Why this position exists

Aletheia's constitution and its plans for a maritime settlement raise real legal questions: what statehood requires, how the law of the sea applies to offshore structures, and which jurisdictions and regulations would govern the work. The answers must come from careful research that separates settled law from interpretation, open questions and aspiration.

## What you will do

- Review the proposed constitutional and institutional framework.
- Research the relevant principles of public international law, maritime law and the law of the sea.
- Set out the legal differences between a political undertaking, a self-declared micronation, a functioning settlement and a recognised state.
- Examine the legal implications of seasteading and offshore infrastructure.
- Identify jurisdictional, environmental, safety, registration and regulatory requirements.
- Recommend checks for future property, maritime infrastructure, corporate, residency and other legal arrangements.
- Identify the questions that need advice from qualified counsel in particular jurisdictions.
- Write structured research memoranda with sources, assumptions, uncertainties and recommendations.

## What you will deliver in the first term

- A review memorandum on the constitution and institutions.
- A register of maritime and seasteading legal issues.
- A research plan for jurisdiction and regulation.
- Recommendations on where independent legal opinions are needed.

## Who we are looking for

Legal researchers, academics, lawyers or policy specialists with experience in constitutional law, public international law, maritime law, the law of the sea or public governance. Admission to practise is not required for this research role; where a task needs a practising lawyer, that will be sought separately.

## Limits of the role

The position does not assert that Aletheia has recognised statehood, sovereign maritime territory, diplomatic status or governmental powers recognised by other states. Your work must keep established law, interpretation, unresolved questions and the State's aims clearly apart. You do not give legal advice on behalf of Aletheia or to third parties.`,
  },
  {
    key: "C",
    expected: "AGV-OPP-2026-0003",
    title: "Economic Development and Investment Research Adviser",
    positionType: "advisory",
    hours: "5 to 8",
    area: "Economic development and strategic planning",
    summary:
      "Build a realistic economic and infrastructure plan for Aletheia's maritime settlement: feasibility, costs, financing, partners and staged milestones, with every estimate labelled as such. Advisory, unpaid, remote.",
    body: `## Why this position exists

A maritime settlement needs energy, water, transport, communications and an economy that can sustain it. Aletheia needs a development plan grounded in evidence: what it would cost, how it could be financed, what could go wrong, and in what order to build.

## What you will do

- Research the economic feasibility of the development model.
- Identify requirements for infrastructure, energy, water, transport, communications and logistics.
- Assess opportunities in services, trade, commerce and food production where they apply.
- Develop preliminary capital and operating cost assumptions.
- Research financing structures, investment models, partnerships and funding risks.
- Identify potential commercial and institutional collaborators.
- Prepare scenario analyses and staged development recommendations.
- Assess environmental, construction, maintenance and operating constraints.
- Propose measurable development milestones and indicators.

## What you will deliver in the first term

- A preliminary economic feasibility report.
- An assessment of infrastructure and development priorities.
- A register of preliminary financial assumptions and risks.
- A phased development roadmap with dependencies and indicative resource needs.

## Who we are looking for

Professionals in economics, infrastructure planning, development or project finance, energy systems, investment analysis, logistics or strategic development.

## Limits of the role

Figures for investment, population, output, revenue or funding are not to be presented as facts: every estimate, assumption and projection must be labelled as one. You may not seek or accept investment, or make commitments to partners, on behalf of Aletheia.`,
  },
  {
    key: "D",
    expected: "AGV-OPP-2026-0004",
    title: "Cybersecurity and Digital Governance Adviser",
    positionType: "advisory",
    hours: "4 to 8",
    area: "Cybersecurity and digital governance",
    summary:
      "Give independent security and governance advice on Aletheia's live digital platforms: the public websites, the government portal, the operations workbench, its records and the StableChain. Advisory, unpaid, remote.",
    body: `## Why this position exists

Aletheia already runs real systems: stateofaletheia.org, aletheiagov.org, the operations workbench in which officials draft, approve and publish records, and the StableChain. They hold applicants' personal data and the public record. They deserve independent scrutiny from people whose profession is finding what others miss.

## What you will do

- Review the architecture of authentication and access control.
- Assess role-based permissions, administrative privilege boundaries and audit logging.
- Review the security of applications, CV handling and applicant data.
- Evaluate session management, secrets handling, API security and deployment practice.
- Identify risks of unauthorised access, privilege escalation, data exposure and unsafe administrative workflows.
- Review the security assumptions of the StableChain and recommend independent validation.
- Recommend practices for backup, incident response, recovery, logging and vulnerability management.
- Produce remediation recommendations ranked by risk and impact.
- Help set proportionate security and privacy policies.

## What you will deliver in the first term

- A security architecture and risk assessment.
- A prioritised remediation register.
- A review of access control and administrative security.
- Recommendations for handling recruitment data securely and for incident response.

## Who we are looking for

Experienced application-security engineers, security analysts, penetration testers, security auditors, cryptography specialists or digital-governance professionals. Certifications are welcome but do not replace demonstrated competence.

## Limits of the role

All testing is authorised in writing and scoped in advance. No unauthorised scanning or exploitation, no access to third-party systems, and no collection of personal data beyond what the agreed work needs. The role does not include unrestricted access to production credentials or to applicants' records.`,
  },
  {
    key: "E",
    expected: "AGV-OPP-2026-0005",
    title: "Founding Partnerships and Recruitment Coordinator",
    positionType: "volunteer",
    hours: "6 to 10",
    area: "Founding partnerships and contributor recruitment",
    summary:
      "Build Aletheia's network of qualified contributors and collaborators: find the right people, run a fair and organised application process, and keep candidates well informed. Volunteer, unpaid, remote.",
    body: `## Why this position exists

Aletheia will be built by the people it attracts. Many are already gathering in online communities around seasteading and new institutions; others work in universities, professional bodies and research centres. Someone needs to find them, invite them properly, and run a recruitment process that treats every applicant with care.

## What you will do

- Identify prospective contributors across the disciplines Aletheia needs.
- Coordinate the publication and promotion of approved opportunities.
- Keep application and candidate communication organised.
- Help screen applications against the published criteria.
- Arrange interviews and assessments with authorised reviewers.
- Research universities, professional associations, research centres and potential collaborators.
- Prepare outreach materials and professional introductions.
- Keep accurate recruitment progress reports and candidate status records.
- Recommend improvements to the process, response rates and the candidate experience.

## What you will deliver in the first term

- A structured recruitment and outreach plan.
- A list of prospective contributors and partners, compiled from appropriate, lawful sources.
- A framework for candidate communication and application tracking.
- A recruitment progress report with practical recommendations.

## Who we are looking for

Experience in recruitment, talent acquisition, partnerships, programme coordination, community building, communications or international relations. Strong writing, organisation, judgement, discretion and follow-through matter most.

## Limits of the role

You may not promise anyone employment, payment, citizenship, diplomatic privileges, appointment or authority unless that has been separately authorised and legally established. Applicants' data is handled only within the government's systems and their privacy rules.`,
  },
].map((p) => ({ ...p, text: `${ABOUT}\n\n${p.body}\n\n${TERMS(p.hours)}\n\n${APPLY}`, facts: FACTS(p.area, p.hours) }));
