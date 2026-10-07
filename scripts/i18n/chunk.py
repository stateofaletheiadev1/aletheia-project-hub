"""Split lib/i18n/source.json into translation work chunks grouped by file."""
import collections
import json
import os
import sys

out = sys.argv[1]
only_missing = '--missing' in sys.argv
d = json.load(open('lib/i18n/source.json', encoding='utf-8'))
done = json.load(open('lib/i18n/messages/de.json', encoding='utf-8')) if only_missing else {}
by = collections.OrderedDict()
for k, loc in d.items():
    if k in done:
        continue
    by.setdefault(loc.rsplit(':', 1)[0], []).append(k)
files = sorted(by, key=lambda f: (0 if f.startswith('components') else 1 if f.startswith('lib') else 2, f))
chunks, cur, words = [], [], 0
for f in files:
    for k in by[f]:
        cur.append((f, k))
        words += len(k.split())
        if words > 1100:
            chunks.append(cur)
            cur, words = [], 0
if cur:
    chunks.append(cur)
for i, c in enumerate(chunks):
    with open(os.path.join(out, f'c{i:02d}.txt'), 'w', encoding='utf-8') as fh:
        last = None
        for f, k in c:
            if f != last:
                fh.write(f'### {f}\n')
                last = f
            fh.write(json.dumps(k, ensure_ascii=False) + '\n')
print(len(chunks), 'chunks')
