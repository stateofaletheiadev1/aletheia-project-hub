import type { Metadata } from "next";
import { ProsePage } from "@/components/editorial/ProsePage";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Accessibility statement for aletheiagov.org: the standard it aims for, what has been tested, and known issues.",
};

export default function AccessibilityPage() {
  return (
    <ProsePage
      mark={{ n: "L3", label: "Policies" }}
      title="Accessibility"
      lede="This site aims to meet WCAG 2.2 at level AA. This statement says what has been done, what has been tested, and what is not yet verified."
      margin={[
        { label: "Target", value: "WCAG 2.2 AA" },
        { label: "Status", value: "Designed to the target; full audit pending" },
        { label: "Version", value: "Founding edition, October 2026" },
      ]}
    >
      <h2>What the site does</h2>
      <ul>
        <li>Every page has a skip link, landmarks and a single main heading.</li>
        <li>Text colours are measured: every text pairing meets a contrast ratio of at least 4.5 to 1.</li>
        <li>Status is never shown by colour alone: each status has its own mark and a written label.</li>
        <li>Everything works with a keyboard, with a visible focus outline.</li>
        <li>Motion is reduced when your device asks for reduced motion, and nothing is hidden if scripts do not run.</li>
        <li>Pages reflow at 320 pixels wide and remain usable at 400 % zoom.</li>
      </ul>

      <h2>How it is tested</h2>
      <p>
        Every public page is audited with axe against WCAG 2.2 AA, and keyboard behaviour is checked by automated tests, before each release. A release with a serious or critical finding is not published. This statement does not claim formal certification.
      </p>

      <h2>Reporting a problem</h2>
      <p>
        If anything on this site is hard to use, write to <a className="link-ledger" href="mailto:info@stateofaletheia.org">info@stateofaletheia.org</a>. Each report is answered.
      </p>
    </ProsePage>
  );
}
