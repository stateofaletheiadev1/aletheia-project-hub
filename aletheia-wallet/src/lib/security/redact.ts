// Log redaction (wallet prompt 14). Everything the wallet logs goes through `log`, which strips
// secret-shaped text: runs of recovery-phrase words and bare 64/128-hex strings (keys, seeds).
// Identifiers keep their `alt:` prefixes and are not secret.

import { wordlist } from "@scure/bip39/wordlists/english.js";

const WORDS = new Set(wordlist);

export function redact(text: string): string {
  let out = text.replace(/(?<![A-Za-z0-9:])[0-9a-fA-F]{64,}(?![0-9a-fA-F])/g, "[redacted hex]");
  const tokens = out.split(/(\s+)/);
  let run: number[] = [];
  const flush = () => {
    if (run.length >= 6) for (const i of run) tokens[i] = "▪";
    run = [];
  };
  tokens.forEach((token, i) => {
    if (/^\s+$/.test(token)) return;
    if (WORDS.has(token.toLowerCase().replace(/[^a-z]/g, ""))) run.push(i);
    else flush();
  });
  flush();
  out = tokens.join("");
  return out.replace(/▪(\s+▪)+/g, "[redacted words]").replace(/▪/g, "[redacted words]");
}

function render(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const log = {
  info: (...values: unknown[]) => console.info(redact(values.map(render).join(" "))),
  warn: (...values: unknown[]) => console.warn(redact(values.map(render).join(" "))),
  error: (...values: unknown[]) => console.error(redact(values.map(render).join(" "))),
};
