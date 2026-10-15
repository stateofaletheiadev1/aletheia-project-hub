import Link from "next/link";
import { SectionMark } from "../ui/feedback";

// What an administrator does first in a new workbench: plain steps, shown on the Overview until
// there are records. Administrators manage people and access; records are written, reviewed,
// approved and released by officials with those roles (brief §18.5, §25).

export function GettingStarted({ officials, founder }: { officials: number; founder: boolean }) {
  if (founder) return <FounderStart />;
  const steps = [
    {
      title: "Invite the people who will do the work",
      body: (
        <>
          Under{" "}
          <Link href="/officials/invite" className="link font-semibold">
            Officials and access
          </Link>
          , invite each person with their role in an institution: <span className="font-semibold">Author</span> (writes drafts), <span className="font-semibold">Reviewer</span> (examines them),{" "}
          <span className="font-semibold">Approving officer</span> (approves, and records adoption of decisions) and <span className="font-semibold">Publishing officer</span> (releases to aletheiagov.org).
          Author and Reviewer apply at once; approving and publishing roles wait for the other administrator to confirm.
        </>
      ),
    },
    {
      title: "To write records yourself, get the Author role",
      body: <>Nobody can change their own access. Ask the other administrator to open your name under Officials and access and add the Author role for an institution.</>,
    },
    {
      title: "Start a record",
      body: (
        <>
          An author opens a register (Documents, Decisions, Dispatches…) and chooses <span className="font-semibold">New</span>. The draft is then submitted, reviewed, approved by someone other than its author,
          and authorised for publication. Every step, and every return or rejection with its reason, is in the record&rsquo;s history and the audit register.
        </>
      ),
    },
  ];
  return (
    <section aria-labelledby="getting-started" className="mx-auto mb-10 max-w-7xl border border-rule bg-sheet p-6">
      <SectionMark n="00">Getting started</SectionMark>
      <h2 id="getting-started" className="mt-2 text-h2 text-ink">
        {officials <= 2 ? "Two administrators and no records yet" : "No records yet"}
      </h2>
      <ol className="mt-5 grid gap-5 md:grid-cols-3 md:gap-8">
        {steps.map((s, i) => (
          <li key={s.title} className="grid content-start gap-1.5 border-t border-rule pt-4">
            <span className="tnum text-h3 text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <p className="text-ui font-semibold text-ink">{s.title}</p>
            <p className="text-ui font-normal text-ink-2">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** For founders (ADR 0009): every step is theirs to take; others share the work. */
function FounderStart() {
  return (
    <section aria-labelledby="getting-started" className="mx-auto mb-10 max-w-7xl border border-rule bg-sheet p-6">
      <SectionMark n="00">Getting started</SectionMark>
      <h2 id="getting-started" className="mt-2 text-h2 text-ink">
        As a founder, every step is yours to take
      </h2>
      <ol className="mt-5 grid gap-5 md:grid-cols-3 md:gap-8">
        <li className="grid content-start gap-1.5 border-t border-rule pt-4">
          <span className="tnum text-h3 text-ink-3">01</span>
          <p className="text-ui font-semibold text-ink">Write</p>
          <p className="text-ui font-normal text-ink-2">
            Open a register (
            <Link href="/records/documents" className="link">
              Documents
            </Link>
            ,{" "}
            <Link href="/records/decisions" className="link">
              Decisions
            </Link>
            ,{" "}
            <Link href="/records/dispatches" className="link">
              Dispatches
            </Link>
            …) and choose New. Classify it Public if it is for the public record.
          </p>
        </li>
        <li className="grid content-start gap-1.5 border-t border-rule pt-4">
          <span className="tnum text-h3 text-ink-3">02</span>
          <p className="text-ui font-semibold text-ink">Take it through, or let others</p>
          <p className="text-ui font-normal text-ink-2">
            You can submit, review, approve, authorise and publish it yourself. Each step you take over a rule that binds other officials is marked in the audit register as taken on a
            founder&rsquo;s authority.
          </p>
        </li>
        <li className="grid content-start gap-1.5 border-t border-rule pt-4">
          <span className="tnum text-h3 text-ink-3">03</span>
          <p className="text-ui font-semibold text-ink">Bring in officials</p>
          <p className="text-ui font-normal text-ink-2">
            Under{" "}
            <Link href="/officials/invite" className="link font-semibold">
              Officials and access
            </Link>
            , invite people with the roles they hold. Your grants take effect at once; they work within their roles, and the usual separation of duties applies to them.
          </p>
        </li>
      </ol>
    </section>
  );
}
