/**
 * Renames local bindings that shadow the i18n `t`/`tx`. Within the binding's
 * scope, `t("literal")` calls stay as translator calls; every other reference
 * is renamed with the binding.
 *   node scripts/i18n/fix-shadowing.mjs file:line:newName ...
 */
import fs from 'node:fs';
import ts from 'typescript';

const byFile = new Map();
for (const spec of process.argv.slice(2)) {
  const [file, line, newName] = spec.split(':');
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line: Number(line), newName });
}

for (const [file, targets] of byFile) {
  let src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];

  const scopeOf = (decl) => {
    let n = decl.parent;
    while (n && !(ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isBlock(n) || ts.isSourceFile(n))) n = n.parent;
    // A parameter's scope is its function; a variable's is the enclosing block.
    return n;
  };

  const visitDecls = (node) => {
    if ((ts.isParameter(node) || ts.isVariableDeclaration(node)) && ts.isIdentifier(node.name)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      const target = targets.find((x) => x.line === line + 1);
      if (target) {
        const old = node.name.text;
        const scope = scopeOf(node);
        const refs = (n) => {
          if (ts.isIdentifier(n) && n.text === old) {
            const p = n.parent;
            const isTranslatorCall = ts.isCallExpression(p) && p.expression === n &&
              p.arguments.length > 0 && (ts.isStringLiteral(p.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(p.arguments[0]));
            const isPropName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n);
            if (!isTranslatorCall && !isPropName) edits.push({ pos: n.getStart(), end: n.getEnd(), text: target.newName });
          }
          ts.forEachChild(n, refs);
        };
        refs(scope);
      }
    }
    ts.forEachChild(node, visitDecls);
  };
  visitDecls(sf);

  edits.sort((a, b) => b.pos - a.pos);
  const seen = new Set();
  for (const e of edits) {
    if (seen.has(e.pos)) continue;
    seen.add(e.pos);
    src = src.slice(0, e.pos) + e.text + src.slice(e.end);
  }
  fs.writeFileSync(file, src);
  console.log(`${file}: ${seen.size} renames`);
}
