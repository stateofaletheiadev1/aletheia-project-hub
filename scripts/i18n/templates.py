"""Hand-finish dynamic sentences: template literals become t('… {var} …', { var })."""

def ed(path, pairs):
    s = open(path, encoding='utf-8').read()
    for old, new in pairs:
        assert old in s, (path, old[:90])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(s)

EC = 'app/[lang]/citizenship/apply/EligibilityChecker.tsx'
ed(EC, [
    ("{ label: `Aged ${MINIMUM_AGE} or over`, met: adult === true,",
     "{ label: t('Aged {age} or over', { age: MINIMUM_AGE }), met: adult === true,"),
    ("label: `${NATURALISATION_RESIDENCE_YEARS} years of lawful residence`,",
     "label: t('{years} years of lawful residence', { years: NATURALISATION_RESIDENCE_YEARS }),"),
    ("hint: `You have ${years} of ${NATURALISATION_RESIDENCE_YEARS} years. Lawful residence opens with territorial establishment — register interest via Immigration.`,",
     "hint: t('You have {years} of {required} years. Lawful residence opens with territorial establishment — register interest via Immigration.', { years, required: NATURALISATION_RESIDENCE_YEARS }),"),
    ("{ label: `Qualifying investment of ${formatAey(total, intl)}`, met: true, hint: '' },",
     "{ label: t('Qualifying investment of {amount}', { amount: formatAey(total, intl) }), met: true, hint: '' },"),
    ("sub: `${NATURALISATION_RESIDENCE_YEARS} years’ residence` },",
     "sub: t('{years} years’ residence', { years: NATURALISATION_RESIDENCE_YEARS }) },"),
    ("sub: `From ${formatAey(INVESTMENT_OPTIONS[0].amount, intl)}` },",
     "sub: t('From {amount}', { amount: formatAey(INVESTMENT_OPTIONS[0].amount, intl) }) },"),
    ("label={`Are you aged ${MINIMUM_AGE} or over?`}",
     "label={t('Are you aged {age} or over?', { age: MINIMUM_AGE })}"),
    ("{tx(o.refundable ? `Held ${o.holdYears} years · returned` : 'One-time contribution')}",
     "{o.refundable ? t('Held {years} years · returned', { years: o.holdYears ?? 0 }) : t('One-time contribution')}"),
])

ed('app/[lang]/citizenship/apply/page.tsx', [
    ("lead={`Earn citizenship through ${NATURALISATION_RESIDENCE_YEARS} years of lawful residence, or invest in building the maritime republic through the Covenant Investor route. Check your eligibility in under a minute.`}",
     "lead={t('Earn citizenship through {years} years of lawful residence, or invest in building the maritime republic through the Covenant Investor route. Check your eligibility in under a minute.', { years: NATURALISATION_RESIDENCE_YEARS })}"),
])

ed('app/[lang]/development/page.tsx', [
    ("aria-label={`${r.label} State`}", "aria-label={t('{name} State', { name: r.label })}"),
])

ed('app/[lang]/registry/page.tsx', [
    ("""<CountUp value={citizens} />{' '}{t("citizens have sworn the Covenant Oath.")}</h2>""",
     """{t('{count} citizens have sworn the Covenant Oath.', { count: citizens.toLocaleString(intl) })}</h2>"""),
    ("""{t("A further")}{' '}{s.registrations.residencyInterest.toLocaleString(intl)}{' '}{t("people have registered interest in lawful residence, which opens with territorial establishment and starts the five-year path to naturalisation.")}""",
     """{t('A further {count} people have registered interest in lawful residence, which opens with territorial establishment and starts the five-year path to naturalisation.', { count: s.registrations.residencyInterest.toLocaleString(intl) })}"""),
])
print('ok')
