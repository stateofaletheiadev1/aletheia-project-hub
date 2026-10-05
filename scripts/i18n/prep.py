"""Convert text-rendering server components into client views before the codemod."""
import os
import re

L = 'app/[lang]'

def read(p):
    return open(p, encoding='utf-8').read()

def write(p, s):
    open(p, 'w', encoding='utf-8').write(s)

LAYOUT = """import type { ReactNode } from 'react';
import {{ routeMetadataFor }} from '@/lib/routes';

export const generateMetadata = routeMetadataFor('{path}');

export default function Layout({{ children }}: {{ children: ReactNode }}) {{
  return children;
}}
""".replace('import type { ReactNode }', 'import type {{ ReactNode }}')

for route in ['accessibility', 'citizenship/apply', 'development', 'education', 'faq', 'healthcare', 'privacy', 'registry', 'society', 'terms']:
    p = f'{L}/{route}/page.tsx'
    s = read(p)
    m = re.search(r"export const generateMetadata = routeMetadataFor\('([^']+)'\);\n\n?", s)
    if m:
        path = m.group(1)
        s = s.replace(m.group(0), '')
        s = s.replace("import { routeMetadataFor } from '@/lib/routes';\n", '')
        lp = f'{L}/{route}/layout.tsx'
        if not os.path.exists(lp):
            write(lp, LAYOUT.format(path=path))
    if not s.startswith("'use client'"):
        s = "'use client';\n\n" + s
    write(p, s)
    print('client page:', route)

for c in ['components/ui/PageHero.tsx', 'components/ui/LegalDocument.tsx', 'components/ui/StatusBadge.tsx']:
    s = read(c)
    if not s.startswith("'use client'"):
        write(c, "'use client';\n\n" + s)

# not-found: client component (404 responses are noindexed automatically)
p = f'{L}/not-found.tsx'
s = read(p)
s = re.sub(r"export const metadata: Metadata = \{[\s\S]*?\};\n\n", '', s)
s = s.replace("import type { Metadata } from 'next';\n", '')
write(p, "'use client';\n\n" + s)


def split_slug_page(route, view_name, param_lookup, meta_builder):
    """page.tsx keeps static params + metadata; the JSX moves to a client view."""
    p = f'{L}/{route}/page.tsx'
    s = read(p)
    head, body = s.split('export default async function', 1)
    # The view: same imports, a plain component taking the slug.
    imports = ''.join(re.findall(r"^import [\s\S]*?;\n", head, re.M))
    imports = re.sub(r"^import type \{ Metadata \} from 'next';\n", '', imports, flags=re.M)
    imports = re.sub(r"^import \{ notFound \} from 'next/navigation';\n", '', imports, flags=re.M)
    sig_end = body.index('{', body.index(')')) + 1
    rest = body[sig_end:]
    rest = re.sub(r"\n  const \{ slug \} = await params;\n", '\n', rest, 1)
    rest = re.sub(r"\n\s*if \(!\w+\)\s*\{?\s*notFound\(\);?\s*\}?\n", '\n', rest, 1)
    rest = rest.replace(f'const {param_lookup[0]} = {param_lookup[1]}(slug);', f'const {param_lookup[0]} = {param_lookup[1]}(slug)!;', 1)
    view = "'use client';\n\n" + imports + f"\nexport function {view_name}({{ slug }}: {{ slug: string }}) {{" + rest
    write(f'{L}/{route}/{view_name}.tsx', view)

    page = head.rstrip() + '\n\n' + meta_builder + f"""
export default async function Page({{ params }}: {{ params: Promise<{{ lang: string; slug: string }}> }}) {{
  const {{ slug }} = await params;
  if (!{param_lookup[1]}(slug)) notFound();
  return <{view_name} slug={{slug}} />;
}}
"""
    write(p, page)


split_slug_page('laws/[slug]', 'StatuteView', ('statute', 'getStatute'), '')
split_slug_page('news/[slug]', 'GazetteArticleView', ('post', 'getGazettePost'), '')
print('split slug pages')
