def ed(path, pairs):
    s = open(path, encoding='utf-8').read()
    for old, new in pairs:
        assert old in s, (path, old[:90])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(s)

ed('app/[lang]/registry/page.tsx', [
    ("sub: `${s.registrations.eResidencyApplicationsPending.toLocaleString(intl)} applications in review` },",
     "sub: t('{count} applications in review', { count: s.registrations.eResidencyApplicationsPending.toLocaleString(intl) }) },"),
])

ed('app/[lang]/immigration/page.tsx', [
    ("notify(`${visa.title}: applications not yet open`,", "notify(t('{visa}: applications not yet open', { visa: t(visa.title) }),"),
])

ed('app/[lang]/portal/documents/page.tsx', [
    ("setDownloadNotice(`Preparing PDF: ${doc.name}`);", "setDownloadNotice(t('Preparing PDF: {name}', { name: doc.name }));"),
    ("setDownloadNotice(`Downloaded: ${doc.name}`);", "setDownloadNotice(t('Downloaded: {name}', { name: doc.name }));"),
])

ed('app/[lang]/portal/wallet/page.tsx', [
    ("description: `Direct transfer to ${recipient.slice(0, 10)}...`,", "description: t('Direct transfer to {recipient}', { recipient: `${recipient.slice(0, 10)}...` }),"),
    ("setNotice(`Transfer of ${num.toFixed(2)} AEY confirmed on StableChain.`);", "setNotice(t('Transfer of {amount} AEY confirmed on StableChain.', { amount: num.toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));"),
])

# Criteria are rendered through tx(); keep them literal so they are extractable.
ed('lib/citizenship.ts', [
    ("""export const NATURALISATION_CRITERIA = [
  `Aged ${MINIMUM_AGE} or over`,
  `${NATURALISATION_RESIDENCE_YEARS} years of lawful, continuous physical residence in Aletheia`,""",
     """// Literal (not templated) so the i18n extractor can find them; keep in step with the constants above.
export const NATURALISATION_CRITERIA = [
  'Aged 18 or over',
  '5 years of lawful, continuous physical residence in Aletheia',"""),
    ("""export const INVESTOR_CRITERIA = [
  `Aged ${MINIMUM_AGE} or over`,""", """export const INVESTOR_CRITERIA = [
  'Aged 18 or over',"""),
])
print('ok')
