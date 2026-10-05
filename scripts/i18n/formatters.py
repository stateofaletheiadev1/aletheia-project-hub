"""Make shared formatters locale-aware and pass the reader's locale from components."""
import re

def ed(path, old, new, count=1):
    s = open(path, encoding='utf-8').read()
    assert old in s, (path, old[:80])
    s = s.replace(old, new, count)
    open(path, 'w', encoding='utf-8').write(s)

# ── lib formatters ──
ed('lib/citizenship.ts', """export function formatAey(amount: number): string {
  return `${amount.toLocaleString('en-GB')} AEY`;""", """export function formatAey(amount: number, intl = 'en-GB'): string {
  return `${amount.toLocaleString(intl)} AEY`;""")

ed('lib/gazette.ts', """export function formatGazetteDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {""", """export function formatGazetteDate(iso: string, intl = 'en-GB'): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(intl, {""")

s = open('lib/national-registry.ts', encoding='utf-8').read()
s = re.sub(r"/\*\* Compact AEY formatting[\s\S]*?\n\}\n", """/** Compact AEY formatting in the reader's locale: 2.45B AEY, 2,45 Mrd. AEY, 612M AEY. */
export function compactAey(amount: number, intl = 'en-GB'): string {
  if (amount < 1e6) return `${amount.toLocaleString(intl)} AEY`;
  const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: amount >= 1e9 ? 2 : 1 }).format(amount);
  return `${compact} AEY`;
}
""", s, count=1)
s = s.replace("""export function monthLabel(ym: string): string {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', {""", """export function monthLabel(ym: string, intl = 'en-GB'): string {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(intl, {""")
open('lib/national-registry.ts', 'w', encoding='utf-8').write(s)
assert 'monthLabel(ym: string, intl' in s and 'Intl.NumberFormat' in s

# ── callers: pass `intl` from useI18n ──
import glob
callers = 0
for f in glob.glob('app/[[]lang]/**/*.tsx', recursive=True) + glob.glob('components/**/*.tsx', recursive=True):
    if '/admin/' in f.replace('\\', '/'):
        continue
    s = open(f, encoding='utf-8').read()
    o = s
    for fn in ('formatGazetteDate', 'formatAey', 'compactAey', 'monthLabel'):
        # fn(x) → fn(x, intl), only for single-argument calls
        s = re.sub(rf"\b{fn}\(([^(),]+(?:\([^()]*\))?[^(),]*)\)", rf"{fn}(\1, intl)", s)
    s = s.replace(".toLocaleString('en-GB')", '.toLocaleString(intl)')
    s = s.replace(".toLocaleDateString('en-GB',", '.toLocaleDateString(intl,')
    s = s.replace('format={compactAey}', 'format={(n) => compactAey(n, intl)}')
    if s != o:
        # make sure the component destructures intl from the hook
        s = re.sub(r"const \{ ([^}]*) \} = useI18n\(\);", lambda m: m.group(0) if 'intl' in m.group(1) else f"const {{ {m.group(1)}, intl }} = useI18n();", s)
        if 'useI18n()' not in s:
            print('NEEDS HOOK:', f)
        open(f, 'w', encoding='utf-8').write(s)
        callers += 1
print('updated callers in', callers, 'files')
