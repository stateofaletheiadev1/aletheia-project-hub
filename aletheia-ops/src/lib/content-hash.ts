// Content hashes (ADR 0003). SHA-256, hex, over canonical JSON (sorted keys, no whitespace).
//
// - The version hash binds approvals to exactly what was approved: register, version number and
//   the full content as submitted.
// - The publication hash is what aletheiagov.org shows beside a published record, and what the
//   portal recomputes before accepting a publication: register, reference, title, summary, body,
//   facts and version. The portal must use this same definition.

import type { Content } from "@/domain/content";
import { canonicalJson, sha256hex } from "./crypto";

export function versionHash(register: string, version: number, content: Content): string {
  return sha256hex(canonicalJson({ register, version, content }));
}

export function publicationHash(p: { register: string; reference: string; title: string; summary: string; body: unknown; facts: unknown; version: number }): string {
  return sha256hex(canonicalJson({ register: p.register, reference: p.reference, title: p.title, summary: p.summary, body: p.body, facts: p.facts, version: p.version }));
}
