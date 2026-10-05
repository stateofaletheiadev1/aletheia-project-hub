"""One official name: "The Sovereign Covenant State of Aletheia" (short form "the Sovereign Covenant State")."""
import glob
import re

files = [f for pat in ('app/**/*.ts', 'app/**/*.tsx', 'components/**/*.tsx', 'lib/**/*.ts', 'docs/**/*.md', 'proxy.ts')
         for f in glob.glob(pat, recursive=True)]

EXACT = [
    # names used as titles/labels
    ('Sovereign Maritime Republic', 'Sovereign Covenant State'),
    ('"Maritime Republic"', '"Sovereign Covenant State"'),
    ('Federal Covenant Republic', 'Sovereign Covenant State'),
    ('Flag Your Vessel with the Republic of Aletheia', 'Flag Your Vessel with the Sovereign Covenant State of Aletheia'),
    ('{t("Republic of Aletheia")}', '{t("Sovereign Covenant State of Aletheia")}'),
    ("siteName: 'Aletheia Digital State'", "siteName: 'The Sovereign Covenant State of Aletheia'"),
    ('Building the Maritime Republic', 'Building the Sovereign Covenant State'),
    ('build the maritime republic', 'build the Sovereign Covenant State'),
    ('building the maritime republic', 'building the Sovereign Covenant State'),
    ('of the sovereign maritime republic', 'of the Sovereign Covenant State'),
    # descriptive phrases that read like a competing name
    ('A Maritime Republic Governed by Covenant', 'A Maritime Nation Governed by Covenant'),
    ('Food security for a maritime republic.', 'Food security for a maritime nation.'),
    ("title: 'A maritime republic'", "title: 'A maritime nation'"),
    ('European-oriented maritime republic', 'European-oriented maritime nation'),
    ('as a compact maritime republic', 'as a compact maritime nation'),
    ("'THE COVENANT STATE OF ALETHEIA'", "'THE SOVEREIGN COVENANT STATE OF ALETHEIA'"),
]

total = 0
for f in files:
    s = open(f, encoding='utf-8').read()
    o = s
    for old, new in EXACT:
        s = s.replace(old, new)
    # Any remaining "Covenant State" not already "Sovereign Covenant State" gains the full name.
    s = re.sub(r'(?<!Sovereign )(?<!SOVEREIGN )\b(the |The )?Covenant State\b', lambda m: f"{m.group(1) or ''}Sovereign Covenant State", s)
    if s != o:
        total += 1
        open(f, 'w', encoding='utf-8').write(s)
print('updated', total, 'files')
