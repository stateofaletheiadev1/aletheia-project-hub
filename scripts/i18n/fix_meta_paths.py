import glob
import os
import re

fixed = 0
for f in glob.glob('app/[[]lang]/**/*.tsx', recursive=True):
    s = open(f, encoding='utf-8').read()
    if 'routeMetadataFor()' not in s:
        continue
    d = os.path.dirname(f).replace(os.sep, '/')
    route = '/' + d.split('app/[lang]', 1)[1].lstrip('/')
    route = route.rstrip('/') or '/'
    s = s.replace('routeMetadataFor()', f"routeMetadataFor('{route}')")
    open(f, 'w', encoding='utf-8').write(s)
    fixed += 1
print('fixed', fixed)

# Re-run prep's layout extraction for the client pages that still carry metadata.
LAYOUT = """import type {{ ReactNode }} from 'react';
import {{ routeMetadataFor }} from '@/lib/routes';

export const generateMetadata = routeMetadataFor('{path}');

export default function Layout({{ children }}: {{ children: ReactNode }}) {{
  return children;
}}
"""
for f in glob.glob('app/[[]lang]/**/page.tsx', recursive=True):
    s = open(f, encoding='utf-8').read()
    if not s.startswith("'use client'"):
        continue
    m = re.search(r"export const generateMetadata = routeMetadataFor\('([^']+)'\);\n\n?", s)
    if not m:
        continue
    s = s.replace(m.group(0), '').replace("import { routeMetadataFor } from '@/lib/routes';\n", '')
    open(f, 'w', encoding='utf-8').write(s)
    lp = os.path.join(os.path.dirname(f), 'layout.tsx')
    if not os.path.exists(lp):
        open(lp, 'w', encoding='utf-8').write(LAYOUT.format(path=m.group(1)))
    print('moved metadata to layout for', m.group(1))
