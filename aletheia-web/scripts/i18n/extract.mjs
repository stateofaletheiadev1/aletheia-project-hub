/**
 * Extracts every translatable English source string into lib/i18n/source.json.
 *
 *   node scripts/i18n/extract.mjs
 *
 * Sources: t("…") calls anywhere, plus string literals in data that reaches
 * the screen through tx() (data arrays in pages, and the lib/ data modules).
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const UI_FILES = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
  .filter((f) => !/[\\/](admin|officer|pdf)[\\/]/.test(f) && !/sitemap|robots|AdminShell/.test(f));
const DATA_FILES = [
  'lib/navigation.ts', 'lib/gazette.ts', 'lib/statutes.ts', 'lib/constitution-data.ts', 'lib/citizenship.ts',
  'lib/national-registry.ts', 'lib/documents.ts', 'lib/status.ts', 'lib/routes.ts', 'lib/auth.ts',
].map((f) => path.join(ROOT, f));

// Object keys whose values are identifiers, not prose.
const NON_TEXT_KEYS = new Set([
  'className', 'href', 'id', 'key', 'image', 'icon', 'slug', 'code', 'hash', 'accent', 'span', 'iconBg', 'color', 'src',
  'type', 'kind', 'route', 'tone', 'size', 'position', 'variant', 'badgeClass', 'dotColor', 'did', 'avatarInitials',
  'intl', 'ogLocale', 'native', 'english', 'changeFrequency', 'month', 'date', 'issuedDate', 'number', 'yieldPct',
  'minSub', 'clearance', 'badgeNumber', 'tokenType', 'aeyBalance', 'imagePosition', 'name_', 'serviceHref', 'link',
  'emoji', 'initials', 'value_', 'asOf', 'source', 'crossReferences', 'filename',
  // HTTP headers set by route handlers.
  'cache-control', 'accept', 'content-type',
]);
const NON_TEXT_ATTRS = new Set(['className', 'href', 'id', 'key', 'src', 'type', 'name', 'role', 'rel', 'target', 'd', 'points', 'viewBox', 'fill', 'stroke', 'sizes', 'htmlFor', 'image', 'status', 'size', 'imagePosition', 'lang', 'method', 'autoComplete', 'inputMode', 'textAnchor', 'transform', 'style', 'tone', 'format', 'route']);

const isProse = (s) => {
  const v = s.replace(/\s+/g, ' ').trim();
  if (!/[A-Za-z]{2,}/.test(v)) return false;
  if (/^(\/|#|https?:|mailto:|0x|did:|data:|@\/|\.\.?\/)/.test(v)) return false;
  if (/^[a-z0-9_.:-]+$/.test(v)) return false;                  // ids, slugs, keys
  if (/^[A-Z0-9_-]+$/.test(v) && !/^[A-Z]{2,5}$/.test(v)) return false; // codes like ACT-2026-04
  if (/^(use client|use server|server-only)$/.test(v)) return false;
  if (/\b[a-z-]+:[a-z]/.test(v) && !/\s[A-Z]/.test(v) && !/^[A-Z]/.test(v)) return false; // variant-prefixed classes
  if (/must be used within/.test(v)) return false; // developer errors
  if (!v.includes(' ') && /^[a-z]/.test(v) && /[-[/]/.test(v)) return false; // single utility class
  if (/^[a-z]+[A-Z][A-Za-z]*$/.test(v)) return false; // camelCase identifiers
  if (/^\(min-width:|^\d+vw$/.test(v)) return false; // responsive image `sizes`
  if (/^-?\d[\d\s.%-]*px/.test(v) || /^main\s/.test(v)) return false; // CSS lengths, selectors
  if (/(rgba?|hsla?|blur|saturate|calc|var|url|radial-gradient|linear-gradient|cubic-bezier|translate3d)\(/.test(v)) return false;
  if (/^(main|body|html|\.|\[)/.test(v) && /[.\[]/.test(v) && !/[A-Za-z]{2,} [a-z]{2,} [a-z]{2,}/.test(v)) return false; // DOM selectors (not sentence fragments)
  if (/\.(pdf|png|jpe?g|svg|webp|json|cer)$/i.test(v)) return false;   // file names
  const css = v.split(' ').filter((w) => /^(-?[a-z]+:)*-?(p[xytrbl]?|m[xytrbl]?|text|bg|border|rounded|flex|grid|w|h|min|max|gap|space|font|leading|tracking|shadow|opacity|z|top|left|right|bottom|inset|col|row|items|justify|self|place|overflow|transition|duration|ease|animate|from|via|to|ring|divide|object|aspect|fill|stroke|translate|scale|rotate|blur|backdrop|order|shrink|grow|basis|line|sr|not|group|peer|hover|focus|lg|md|sm|xl|block|inline|hidden|absolute|relative|fixed|sticky|uppercase|italic|underline|truncate|whitespace|break|cursor|pointer|select|outline|list|decoration|tabular|mix|filter)\b/.test(w));
  if (css.length >= 2 && css.length >= v.split(' ').length / 2) return false;
  return true;
};

const found = new Map(); // normalized → first location

function add(text, file, node, sf, explicit = false) {
  const v = text.replace(/\s+/g, ' ').trim();
  if (explicit ? !/\p{L}/u.test(v) : !isProse(v)) return; // explicit t() calls are always translatable
  if (!found.has(v)) {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    found.set(v, `${path.relative(ROOT, file).replace(/\\/g, '/')}:${line + 1}`);
  }
}

function scan(file, mode) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const visit = (node) => {
    // t("…") anywhere
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const a = node.arguments[0];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) add(a.text, file, a, sf, true);
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      const skip =
        ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) ||
        (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && ['t', 'require', 'import'].includes(p.expression.text)) ||
        (ts.isPropertyAssignment(p) && p.name === node) ||
        (ts.isPropertyAssignment(p) && NON_TEXT_KEYS.has(p.name.getText().replace(/['"]/g, '')) &&
          // `type` / `kind` / `source` sometimes hold displayed labels ("Fiscal Status Attestation")
          !(['type', 'kind', 'source'].includes(p.name.getText()) && /^[A-Z][a-z]+( [A-Za-z&]+)+$/.test(node.text))) ||
        (ts.isJsxAttribute(p) && NON_TEXT_ATTRS.has(p.name.getText())) ||
        (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) && NON_TEXT_ATTRS.has(p.parent.name.getText())) ||
        ts.isLiteralTypeNode(p) || ts.isElementAccessExpression(p) ||
        (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) ||
        ts.isCaseClause(p) ||
        (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ['includes', 'startsWith', 'endsWith', 'getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'addEventListener', 'removeEventListener', 'matchMedia', 'get', 'set', 'has', 'replace', 'split', 'join', 'toLocaleDateString', 'toLocaleString', 'push', 'createElement'].includes(p.expression.name.text));
      if (!skip && (mode === 'data' || mode === 'ui')) add(node.text, file, node, sf);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

for (const f of UI_FILES) scan(f, 'ui');
for (const f of DATA_FILES) scan(f, 'data');

const sorted = Object.fromEntries([...found.entries()].sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(ROOT, 'lib/i18n/source.json'), JSON.stringify(sorted, null, 2) + '\n');
const words = Object.keys(sorted).reduce((n, s) => n + s.split(' ').length, 0);
console.log(`${Object.keys(sorted).length} strings, ${words} words → lib/i18n/source.json`);
