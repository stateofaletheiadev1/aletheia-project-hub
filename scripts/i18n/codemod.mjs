/**
 * One-off i18n codemod (kept for reference and re-runs on new files).
 *
 *   node scripts/i18n/codemod.mjs <file...>
 *
 * - JSX text                      → {t("…")}
 * - translatable string attributes → attr={t("…")}
 * - rendered expressions          → {tx(expr)}   (tx passes non-strings through)
 * - injects `const { t, tx } = useI18n()` into the owning component
 * Prints anything it could not convert safely (template literals, hooks
 * outside components) so it can be handled by hand.
 */
import fs from 'node:fs';
import ts from 'typescript';

const TRANSLATABLE_ATTRS = new Set([
  'alt', 'title', 'placeholder', 'aria-label', 'label', 'lead', 'eyebrow', 'unit', 'heading',
  'subtitle', 'description', 'caption', 'summary', 'kicker', 'desc',
]);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…', middot: '·', copy: '©', rarr: '→', larr: '←', bull: '•', ge: '≥', le: '≤', sect: '§', times: '×', euro: '€', deg: '°' };

function decode(text) {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

const hasWords = (s) => /[A-Za-zÀ-ɏЀ-ӿ]{2,}/.test(s);

function isComponentName(name) {
  return !!name && /^[A-Z]/.test(name);
}

function functionName(fn) {
  if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
  if (ts.isFunctionDeclaration(fn) && !fn.name) return 'Default';
  const p = fn.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isCallExpression(p)) {
    // forwardRef/memo(function X() {}) or memo(() => …) assigned to a const
    const gp = p.parent;
    if (gp && ts.isVariableDeclaration(gp) && ts.isIdentifier(gp.name)) return gp.name.text;
  }
  return null;
}

function transform(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = []; // { pos, del, ins }
  const used = new Map(); // component fn node → Set('t'|'tx')
  const report = [];

  const isAlreadyT = (expr) =>
    ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && ['t', 'tx'].includes(expr.expression.text);

  function owner(node, name) {
    let n = node.parent;
    while (n) {
      if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
        if (isComponentName(functionName(n))) {
          if (!used.has(n)) used.set(n, new Set());
          used.get(n).add(name);
          return true;
        }
      }
      n = n.parent;
    }
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    report.push(`${file}:${line + 1} no component owner for ${name}()`);
    return false;
  }

  function replace(node, text) {
    edits.push({ pos: node.getStart(), del: node.getEnd() - node.getStart(), ins: text });
  }
  function wrap(expr, fn) {
    edits.push({ pos: expr.getStart(), del: 0, ins: `${fn}(` });
    edits.push({ pos: expr.getEnd(), del: 0, ins: ')' });
  }
  function noteTemplate(node) {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    report.push(`${file}:${line + 1} template literal: ${node.getText().slice(0, 80)}`);
  }

  function shouldWrapExpr(expr) {
    if (!expr) return false;
    if (isAlreadyT(expr)) return false;
    if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) return false;
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return false;
    if (ts.isCallExpression(expr)) return false;
    if (ts.isNumericLiteral(expr) || ts.isObjectLiteralExpression(expr) || ts.isArrayLiteralExpression(expr)) return false;
    if (ts.isTemplateExpression(expr)) { noteTemplate(expr); return false; }
    if (ts.isNoSubstitutionTemplateLiteral(expr)) return hasWords(expr.text);
    return (
      ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr) ||
      ts.isConditionalExpression(expr) || ts.isBinaryExpression(expr) || ts.isParenthesizedExpression(expr) ||
      ts.isAsExpression(expr)
    );
  }

  function visit(node) {
    // A) JSX text
    if (ts.isJsxText(node)) {
      const raw = node.getFullText();
      if (hasWords(raw)) {
        const core = decode(raw).replace(/\s+/g, ' ').trim();
        const lead = /^[ \t]+\S/.test(raw) && !/^\s*\n/.test(raw);
        const trail = /\S[ \t]+$/.test(raw) && !/\n\s*$/.test(raw);
        if (owner(node, 't')) {
          edits.push({
            pos: node.getFullStart(),
            del: node.getEnd() - node.getFullStart(),
            ins: `${lead ? "{' '}" : ''}{t(${JSON.stringify(core)})}${trail ? "{' '}" : ''}`,
          });
        }
      }
      return;
    }

    // B/D) expressions rendered as JSX children
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const expr = node.expression;
      if (ts.isStringLiteral(expr)) {
        if (hasWords(expr.text) && owner(node, 't')) replace(expr, `t(${JSON.stringify(expr.text)})`);
      } else if (shouldWrapExpr(expr) && owner(node, 'tx')) {
        wrap(expr, 'tx');
      }
    }

    // C/E) translatable attributes
    if (ts.isJsxAttribute(node) && TRANSLATABLE_ATTRS.has(node.name.getText())) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) {
        if (hasWords(init.text) && owner(node, 't')) replace(init, `{t(${JSON.stringify(init.text)})}`);
      } else if (init && ts.isJsxExpression(init) && init.expression) {
        const expr = init.expression;
        if (ts.isStringLiteral(expr)) {
          if (hasWords(expr.text) && owner(node, 't')) replace(expr, `t(${JSON.stringify(expr.text)})`);
        } else if (shouldWrapExpr(expr) && owner(node, 'tx')) {
          wrap(expr, 'tx');
        }
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(sf);

  if (edits.length === 0) return { changed: false, report };

  // Inject the hook into each owning component.
  for (const [fn, names] of used) {
    const decl = `const { ${[...names].sort().join(', ')} } = useI18n();`;
    const body = fn.body;
    if (ts.isBlock(body)) {
      const already = body.statements.some((s) => s.getText().includes('useI18n()'));
      if (!already) edits.push({ pos: body.getStart() + 1, del: 0, ins: `\n  ${decl}` });
    } else {
      edits.push({ pos: body.getStart(), del: 0, ins: `{\n  ${decl}\n  return ` });
      edits.push({ pos: body.getEnd(), del: 0, ins: ';\n}' });
    }
  }

  let out = src;
  // Back to front; at equal positions apply replacements before insertions.
  edits.sort((a, b) => b.pos - a.pos || (b.del > 0 ? 1 : 0) - (a.del > 0 ? 1 : 0));
  for (const e of edits) out = out.slice(0, e.pos) + e.ins + out.slice(e.pos + e.del);

  if (!out.includes("from '@/components/i18n/I18nProvider'")) {
    const firstImport = out.search(/^import /m);
    out = out.slice(0, firstImport) + "import { useI18n } from '@/components/i18n/I18nProvider';\n" + out.slice(firstImport);
  }
  fs.writeFileSync(file, out);
  return { changed: true, report };
}

const all = [];
let changed = 0;
for (const f of process.argv.slice(2)) {
  const r = transform(f);
  if (r.changed) changed++;
  all.push(...r.report);
}
console.log(`transformed ${changed} files`);
for (const line of all) console.log('  ! ' + line);
