/**
 * Fails if any binding named `t`, `tx` or `intl` shadows the i18n hook's
 * values inside a component that uses them.
 *   node scripts/i18n/check-shadowing.mjs <file...>
 */
import fs from 'node:fs';
import ts from 'typescript';

const NAMES = new Set(['t', 'tx', 'intl']);
let problems = 0;

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('useI18n()')) continue;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visit = (node) => {
    let name = null;
    if ((ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name)) {
      name = node.name.text;
    }
    if (name && NAMES.has(name)) {
      // The hook's own destructuring is the one legitimate binding.
      const isHook = ts.isBindingElement(node) && node.parent?.parent && ts.isVariableDeclaration(node.parent.parent) &&
        node.parent.parent.initializer?.getText().startsWith('useI18n(');
      if (!isHook) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        console.log(`${file}:${line + 1} shadows '${name}'`);
        problems++;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
if (problems) {
  console.log(`${problems} shadowing binding(s)`);
  process.exit(1);
}
console.log('no shadowing');
