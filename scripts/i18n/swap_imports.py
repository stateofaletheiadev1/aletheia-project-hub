"""Route all navigation through locale-aware wrappers."""
import glob
import re

files = [f for f in glob.glob('app/[[]lang]/**/*.tsx', recursive=True) + glob.glob('components/**/*.tsx', recursive=True)
         if 'components/i18n' not in f.replace('\\', '/')]

link_n = nav_n = 0
for f in files:
    s = open(f, encoding='utf-8').read()
    o = s
    s = s.replace("import Link from 'next/link';", "import Link from '@/components/i18n/Link';")
    if s != o:
        link_n += 1

    m = re.search(r"import \{([^}]*)\} from 'next/navigation';", s)
    if m:
        names = [n.strip() for n in m.group(1).split(',') if n.strip()]
        ours = [n for n in names if n in ('usePathname', 'useRouter')]
        theirs = [n for n in names if n not in ours]
        if ours:
            repl = ''
            if theirs:
                repl += f"import {{ {', '.join(theirs)} }} from 'next/navigation';\n"
            repl += f"import {{ {', '.join(ours)} }} from '@/lib/i18n/navigation';"
            s = s.replace(m.group(0), repl)
            nav_n += 1
    if s != o:
        open(f, 'w', encoding='utf-8').write(s)

print(f'Link swapped in {link_n} files; navigation hooks in {nav_n} files')
