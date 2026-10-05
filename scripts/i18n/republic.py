"""'The Republic' is the Sovereign Covenant State: use the one official name."""
import glob
import re

files = [f for pat in ('app/**/*.tsx', 'components/**/*.tsx', 'lib/**/*.ts') for f in glob.glob(pat, recursive=True)]
EXACT = [
    ('a completely cashless republic', 'a completely cashless nation'),
    ('A constitutional republic engineered', 'A constitutional state engineered'),
    ('Invest in the infrastructure of a new republic.', 'Invest in the infrastructure of the Sovereign Covenant State.'),
    ('A paperless republic engineered', 'A paperless state engineered'),
    ('establishing the federal republic', 'establishing the Sovereign Covenant State'),
    ('for a net-zero republic', 'for a net-zero nation'),
    ('of a republic without income tax', 'of a state without income tax'),
    ('Build the republic. Start by learning it.', 'Build the Sovereign Covenant State. Start by learning it.'),
]
n = 0
for f in files:
    s = open(f, encoding='utf-8').read()
    o = s
    for a, b in EXACT:
        s = s.replace(a, b)
    s = re.sub(r"\bthe [Rr]epublic('s)?\b", lambda m: "the Sovereign Covenant State" + (m.group(1) or ''), s)
    s = re.sub(r"\bThe Republic('s)?\b", lambda m: "The Sovereign Covenant State" + (m.group(1) or ''), s)
    if s != o:
        n += 1
        open(f, 'w', encoding='utf-8').write(s)
print('updated', n, 'files')
