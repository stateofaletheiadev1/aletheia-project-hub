import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_STATE, CLASSIFICATION, INSTITUTION_STATE, PRIORITY, PUBLICATION_STATE, RECORD_STATE, type Term } from "@/domain/glossary";
import { REGISTER, REGISTERS } from "@/domain/registers";
import { PERMISSION_LABEL, PERMISSIONS, PRIVILEGED_ROLES, ROLE_INFO, ROLES } from "@/policy/roles";
import { DEFINITIONS } from "@/workflow/definitions";
import { ACTION_LABEL } from "@/workflow/types";

// docs/GLOSSARY.md and docs/security/PERMISSION_MATRIX.md are generated from the code, so they
// cannot drift (brief §15, §25). `npm run docs` rewrites them; this test fails when they are stale.

const root = path.resolve(__dirname, "../..");
const write = import.meta.env.MODE === "write";

function table(terms: Record<string, Term>): string {
  return ["| Term | Meaning |", "|---|---|", ...Object.values(terms).map((t) => `| ${t.label} | ${t.meaning} |`)].join("\n");
}

function glossary(): string {
  return [
    "# Glossary",
    "",
    "Generated from `src/domain/glossary.ts` by `npm run docs`. Do not edit by hand. These words are used",
    "identically in the interface, the API, the audit register and the publication mapping.",
    "",
    "## Record status",
    "",
    table(RECORD_STATE),
    "",
    "## Classification",
    "",
    table(CLASSIFICATION),
    "",
    "## Priority",
    "",
    table(PRIORITY),
    "",
    "## Publication (publication log)",
    "",
    table(PUBLICATION_STATE),
    "",
    "## Accounts",
    "",
    table(ACCOUNT_STATE),
    "",
    "## Institutions (as on aletheiagov.org)",
    "",
    table(INSTITUTION_STATE),
    "",
    "## Registers",
    "",
    "| Register | Reference | Publication rule |",
    "|---|---|---|",
    ...REGISTERS.map((r) => `| ${REGISTER[r].label} | \`AGV-${REGISTER[r].referenceType}\` | ${REGISTER[r].publicationRule} |`),
    "",
  ].join("\n");
}

function matrix(): string {
  const yes = "●";
  const lines = [
    "# Permission matrix",
    "",
    "Generated from `src/policy/roles.ts` and `src/workflow/definitions.ts` by `npm run docs`. Do not edit by hand.",
    "",
    "Every grant is a role, scoped to one institution or to all (`*`), with a clearance (the highest",
    "classification it may see). Permissions are checked on the server for every page, action, query",
    "and publication call. Nobody without an active account and a confirmed authenticator holds any",
    "permission. Roles marked † need a second administrator to grant or remove (two-person rule).",
    "",
    "## Roles",
    "",
    "| Role | Summary |",
    "|---|---|",
    ...ROLES.map((r) => `| ${ROLE_INFO[r].label}${PRIVILEGED_ROLES.includes(r) ? " †" : ""} | ${ROLE_INFO[r].summary} |`),
    "",
    "## Permissions by role",
    "",
    `| Permission | ${ROLES.map((r) => ROLE_INFO[r].label).join(" | ")} |`,
    `|---|${ROLES.map(() => ":-:").join("|")}|`,
    ...PERMISSIONS.map((p) => `| ${PERMISSION_LABEL[p]} (\`${p}\`) | ${ROLES.map((r) => (ROLE_INFO[r].grants.includes(p) ? yes : "")).join(" | ")} |`),
    "",
    "## Workflow steps and the permission each needs",
    "",
  ];
  for (const r of REGISTERS) {
    const def = DEFINITIONS[r];
    lines.push(`### ${REGISTER[r].label} (\`${def.id}\`)`, "");
    lines.push(`Approvals required: ${def.requiredApprovals}. Approver may also release: ${def.sod.approverMayNotPublish ? "no" : "yes"}.`, "");
    lines.push("| Step | From | To | Permission | Conditions |", "|---|---|---|---|---|");
    for (const t of def.transitions) {
      const label = ACTION_LABEL[t.action].replace("{noun}", REGISTER[r].noun);
      lines.push(`| ${label} | ${t.from.map((s) => RECORD_STATE[s].label).join(", ")} | ${RECORD_STATE[t.to].label} | ${t.permission ? `\`${t.permission}\`` : "system"} | ${t.guards.map((g) => `\`${g}\``).join(", ")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

describe("generated documentation", () => {
  it.each([
    ["docs/GLOSSARY.md", glossary],
    ["docs/security/PERMISSION_MATRIX.md", matrix],
  ] as const)("%s is current (run `npm run docs`)", (file, build) => {
    const p = path.join(root, file);
    const content = build();
    if (write) writeFileSync(p, content);
    expect(readFileSync(p, "utf8").replace(/\r\n/g, "\n")).toBe(content);
  });
});
