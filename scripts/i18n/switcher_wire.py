import re

p = 'components/layout/Navbar.tsx'
s = open(p, encoding='utf-8').read()
start = s.index('            {/* language */}\n            <div className="relative">')
end = s.index('            <span className="text-white/15">|</span>\n            <Link\n              href="/admin/login"')
s = s[:start] + '            {/* language */}\n            <LanguageMenu />\n\n' + s[end:]

old_drawer = """            <div className="border-t border-[#15294A]/[0.07] px-4 py-4 flex flex-col gap-2">
              <Link
                href="/e-residency\""""
assert old_drawer in s
s = s.replace(old_drawer, """            <div className="border-t border-[#15294A]/[0.07] px-4 py-3 text-[13px]">
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#C49A4E] mb-2">{t("Language")}</span>
              <LanguageLinks tone="light" onSwitch={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-[#15294A]/[0.07] px-4 py-4 flex flex-col gap-2">
              <Link
                href="/e-residency\"""", 1)

# langOpen state is no longer used
s = s.replace("  const [langOpen,   setLangOpen]     = useState(false);\n", '')
s = s.replace(' setLangOpen(false);', '')
s = re.sub(r"setActiveMenu\(null\); setMobileOpen\(false\); setLangOpen\(false\);", 'setActiveMenu(null); setMobileOpen(false);', s)
s = s.replace("import { useI18n } from '@/components/i18n/I18nProvider';",
              "import { useI18n } from '@/components/i18n/I18nProvider';\nimport { LanguageLinks, LanguageMenu } from '@/components/i18n/LanguageSwitcher';", 1)
open(p, 'w', encoding='utf-8').write(s)
print('langOpen left:', s.count('langOpen'), s.count('setLangOpen'))

p = 'components/layout/Footer.tsx'
s = open(p, encoding='utf-8').read()
m = re.search(r'          <div className="flex flex-wrap items-center gap-4 text-\[11px\]">\n            <span>\{t\("Official Languages:"\)\}</span>[\s\S]*?\n          </div>\n', s)
assert m
s = s.replace(m.group(0), """          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span>{t("Official Languages:")}</span>
            <LanguageLinks />
          </div>
""")
s = s.replace("import { useI18n } from '@/components/i18n/I18nProvider';",
              "import { useI18n } from '@/components/i18n/I18nProvider';\nimport { LanguageLinks } from '@/components/i18n/LanguageSwitcher';", 1)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
