import { art, chapter, type PartSource } from '../types';

export const PARTS_XII_XV: PartSource[] = [
  {
    numeral: 'XII',
    title: 'The Reserve Bank of Aletheia and the Aletheian Guilder',
    chapters: [
      chapter(
        'The Currency',
        art('guilder', 'The Aletheian Guilder', [
          'The unit of account of the Sovereign Covenant State is the Aletheian Guilder (AEY), divided into one hundred cents.',
          'The Reserve Bank of Aletheia has the exclusive right to issue the Guilder, in banknotes and in such other forms, including digital forms, as law permits.',
          'The Guilder becomes legal tender in the national territory when an Act of the Covenant Assembly so provides, which may be passed only after this Constitution has entered into force and the State has the lawful authority to designate legal tender.',
          'The issue of banknotes is not by itself a monetary system. Before the Guilder is designated legal tender, the Reserve Bank shall publish its monetary framework under [[monetary-framework]], and the Auditor-General shall certify that the issuance register and the reserves, if any, are as published.',
        ]),
        art('issuance', 'Rules of Issue and the Issuance Register', [
          'The Reserve Bank shall issue currency only under published rules adopted under [[monetary-framework]]. Undisclosed, arbitrary or unrecorded issuance is prohibited.',
          'Every issue and every withdrawal of currency shall be recorded in a public Issuance Register, stating the date, the amount, the form and the authority for the issue. The Register shall be verifiable by any person in accordance with Part XVII.',
          'The total amount of currency in circulation and the assets held against it shall be published at least monthly.',
        ]),
        art('banknotes', 'Banknotes, Design and Authentication', [
          'The denominations, design and security features of banknotes are determined by the Reserve Bank and published. Banknotes shall bear the coat of arms, the national motto and the signature of the Governor.',
          'Counterfeiting the currency, and knowingly uttering or possessing counterfeit currency, are criminal offences.',
          'The Reserve Bank shall replace damaged banknotes in accordance with published rules and shall publish the procedure and timetable for the withdrawal of any series.',
        ]),
        art('backing-claims', 'Truthfulness of Monetary Claims', [
          'No public authority, and no person acting on its behalf, shall make any public statement concerning the backing, reserves, convertibility, redemption, exchange rate or international acceptance of the Guilder that is not accurate and verifiable.',
          'The Reserve Bank shall not promise or imply convertibility or redemption of the Guilder into any other currency or asset unless the resources, legal commitments and operational arrangements to honour that promise exist and have been published and certified by the Auditor-General.',
          'Any exchange-rate arrangement, including a fixed rate or a currency board, may be adopted only under [[monetary-framework]] and shall be accompanied by the publication of the reserves that support it.',
        ]),
      ),
      chapter(
        'The Reserve Bank',
        art('rba', 'The Reserve Bank of Aletheia', [
          'The Reserve Bank of Aletheia is the central bank of the Sovereign Covenant State. It is a public legal person established by this Constitution and the Reserve Bank Act.',
          'The primary objective of the Reserve Bank is to maintain the stability of the value of the Guilder. Without prejudice to that objective, it supports the stability of the financial system and the general economic policy of the government.',
          'The Reserve Bank is responsible for issuing the currency, conducting monetary policy, managing reserves, overseeing payment systems and, if law so assigns, supervising banks and other financial institutions.',
        ]),
        art('rba-independence', 'Independence of the Reserve Bank', [
          'In the performance of its functions the Reserve Bank, its Governor and the members of its decision-making bodies shall neither seek nor take instructions from the Chancellor, the Cabinet, any Minister or any other person or body.',
          'The Reserve Bank has its own budget, approved by its Board and audited under [[rba-accountability]]. Its profits are transferred to the Consolidated Fund after the reserves required by law.',
          'Law may not reduce the independence of the Reserve Bank, and no decision of the Reserve Bank on monetary policy is subject to approval by any other authority.',
        ]),
        art('rba-governor', 'The Governor and the Monetary Policy Committee', [
          'The Reserve Bank is headed by a Governor, appointed by the Chancellor with the consent of three-fifths of all members of the Covenant Assembly and a majority of all members of the Council of States, for a single term of seven years.',
          'The Governor must be a citizen of recognised standing and professional experience in monetary or banking matters, and may not hold any other office or engage in any business during the term or for two years after it, save with the approval of the Commissioner for Public Standards.',
          'Monetary policy is decided by a Monetary Policy Committee of five members: the Governor, a Deputy Governor and three external members, appointed by the same procedure as the Governor for staggered terms of six years, not renewable.',
          'The Governor or a member of the Monetary Policy Committee may be removed only if the person no longer fulfils the conditions required for office or has been guilty of serious misconduct, by decision of the High Court on the application of the Covenant Assembly made by three-fifths of all members.',
          'The Monetary Policy Committee shall publish its decisions with reasons and the record of its deliberations within a period fixed by law.',
        ]),
        art('rba-functions', 'Reserves, Payment Systems and Financial Stability', [
          'The Reserve Bank holds and manages the official reserves of the State, which may include foreign currencies, gold and other assets designated by law. Their composition and value shall be published at least quarterly.',
          'The Reserve Bank oversees payment systems and settlement systems, including any distributed-ledger system used for the issue or transfer of the Guilder, to ensure their safety and efficiency.',
          'The Reserve Bank may provide emergency liquidity to solvent financial institutions against adequate collateral, under rules published in advance; every such operation shall be reported to the committee on monetary affairs of the Covenant Assembly in confidence promptly and published within twelve months.',
          'Unclaimed balances held by the Reserve Bank shall be dealt with in accordance with law and published.',
        ]),
        art('no-monetary-finance', 'Prohibition of Monetary Financing', [
          'The Reserve Bank shall not finance the deficits of the State. It shall not grant overdrafts or any other credit facility to the federation, a constituent unit or any public undertaking, and shall not purchase debt instruments directly from them.',
          'The Reserve Bank may provide banking services to the Treasury on commercial terms, including the holding of deposits and the management of payments.',
          'Clause (1) may not be suspended during a state of emergency.',
        ]),
        art('monetary-framework', 'The Monetary Framework', [
          'The Reserve Bank shall adopt and publish a monetary framework, stating its quantified policy objective, the instruments it will use, the rules for the issue of currency, any exchange-rate arrangement and the policy on reserves and redemption.',
          'The monetary framework and any amendment to it shall be laid before the Covenant Assembly, which may debate it but not alter it.',
          'An exchange-rate arrangement that commits the reserves of the State, and accession to any monetary union, require an Act of the Covenant Assembly passed by three-fifths of all members.',
        ]),
        art('rba-accountability', 'Accountability of the Reserve Bank', [
          'The Governor shall appear before the committee on monetary affairs of the Covenant Assembly at least twice each year and present the annual report of the Reserve Bank.',
          'The accounts of the Reserve Bank shall be audited annually by independent external auditors appointed by its Board, and examined by the Auditor-General, whose report shall be published.',
          'The Reserve Bank shall publish monetary and financial statistics in accordance with recognised international standards.',
          'Decisions of the Reserve Bank are subject to judicial review for their legality. Parliamentary oversight under this Article shall not extend to instructions on monetary policy.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XIII',
    title: 'Treasury, Taxation, Public Debt and National Wealth',
    chapters: [
      chapter(
        'Public Revenue',
        art('treasury', 'The Treasury and the Consolidated Fund', [
          'The Treasury is the part of the Ministry of Treasury and Finance responsible for public revenue, expenditure, accounts and debt.',
          'All public revenues are paid into the Consolidated Fund, save those assigned by this Constitution to the Covenant Endowment Fund or by law to a fund established under [[funds]].',
          'No money shall be withdrawn from the Consolidated Fund except under an appropriation made by law.',
        ]),
        art('taxation', 'Taxation and the Zero-Tax Principle', [
          'No tax, duty or charge shall be levied except under an Act of the Covenant Assembly.',
          'No tax shall be levied on personal income, on capital gains or on inheritances and gifts.',
          'Public services are financed by ground rents and concession revenues from the national territory, by fees and charges for public services, by the yield of the Covenant Endowment Fund, and by such other taxes as law imposes in accordance with this Article.',
          'A new kind of tax may be introduced only by an Act passed by three-fifths of all members of the Covenant Assembly, stating the purpose of the tax and the period for which it is imposed.',
          'Taxes shall be levied in accordance with the principles of equality, legality and capacity to pay, and shall not be retroactive.',
        ]),
        art('endowment', 'The Covenant Endowment Fund', [
          'There is established the Covenant Endowment Fund, a permanent fund held in trust for present and future generations of Aletheians.',
          'The Fund receives the share of ground rents, concession revenues and other public revenues assigned to it by law, and such other contributions as law provides.',
          'The capital of the Fund shall be preserved. The amount that may be transferred each year to the Consolidated Fund shall not exceed a percentage of the average market value of the Fund over the preceding five years, fixed by law and not exceeding four per cent.',
          'The Fund shall be managed by an independent board appointed under law, in accordance with a published investment policy, and audited annually by the Auditor-General. Its holdings and returns shall be published at least quarterly.',
          'The Fund shall not lend to the State or acquire assets from members of the Cabinet or persons connected to them.',
        ]),
      ),
      chapter(
        'Budget and Expenditure',
        art('budget', 'The Annual Budget', [
          'The Cabinet shall lay the Budget Bill for each financial year before the Covenant Assembly not later than three months before the year begins, together with a medium-term fiscal plan for at least four years and a statement of contingent liabilities.',
          'The budget shall include all revenue and expenditure of the State. Off-budget funds and expenditure are prohibited, save for the funds established under [[funds]] and the Covenant Endowment Fund, whose accounts shall be published with the budget.',
          'If the Budget Bill has not been enacted when the financial year begins, the Cabinet may spend, for each month until it is enacted, no more than one-twelfth of the appropriations of the previous year, and only for continuing purposes.',
          'Supplementary appropriations require an Act of the Covenant Assembly.',
        ]),
        art('fiscal-rule', 'Fiscal Responsibility and Public Debt', [
          'The budget of the State shall, over the economic cycle, be balanced without recourse to borrowing, save for borrowing for public investment.',
          'The State may borrow only under an Act of the Covenant Assembly. The total public debt, including guarantees, shall not exceed the limit set by law, which shall not exceed sixty per cent of the national income as measured under law.',
          'The terms of all public borrowing and guarantees shall be published.',
          'Borrowing in excess of the limit is permitted only in a state of emergency declared under Part XX or in the event of a natural disaster, by an Act passed by three-fifths of all members of the Covenant Assembly, which shall include a plan for repayment.',
        ]),
        art('guarantees', 'Guarantees, Contingent Liabilities and Public Undertakings', [
          'The State may give a guarantee or assume a contingent liability only under an Act of the Covenant Assembly. Every guarantee shall be published and recorded in a register of contingent liabilities.',
          'State-owned undertakings shall be established by law, governed by independent boards, subject to audit by the Auditor-General and required to publish their accounts.',
          'Agreements between public authorities and private undertakings for the financing, construction or operation of public infrastructure shall be published, assessed for value for money by the Auditor-General before signature, and approved by an Act where their value exceeds a threshold set by law.',
        ]),
        art('funds', 'National Infrastructure Funds and Maritime Revenues', [
          'Law may establish a National Infrastructure Fund and other special funds for defined purposes, whose accounts shall be published with the budget.',
          'Revenues from the lawful use of marine resources, energy generation and port operations within the national territory are public revenues and shall be accounted for under this Part.',
        ]),
        art('capital-plan', 'Multi-Year Capital Planning and Emergency Expenditure', [
          'The Cabinet shall publish a national capital plan of at least ten years, updated every two years, identifying the major infrastructure to be built, its cost and its funding.',
          'In a state of emergency the Cabinet may authorise expenditure not provided for in the budget, up to a limit set by law, provided that a supplementary appropriation bill is laid before the Covenant Assembly within thirty days and every such expenditure is published.',
        ]),
      ),
      chapter(
        'Public Accounts and Audit',
        art('accounts', 'Public Accounts and Reporting', [
          'The Treasury shall publish monthly statements of revenue, expenditure and borrowing, and annual consolidated accounts of the State prepared in accordance with recognised public-sector accounting standards.',
          'The public shall be able to see how public money is spent: the State shall publish every payment above a threshold set by law, with the payee and the purpose.',
          'Records of public revenue and expenditure shall be kept in a manner that allows their integrity to be verified under Part XVII.',
        ]),
        art('audit', 'External Audit', [
          'The accounts of every public authority, the Reserve Bank, the Covenant Endowment Fund and every state-owned undertaking are audited by the Auditor-General under Part XIX.',
          'The Auditor-General’s reports are laid before the Covenant Assembly and published, and are examined by the committee on public accounts.',
        ]),
        art('intergenerational', 'Intergenerational Fiscal Responsibility', [
          'The State shall manage the public finances so that the burdens and benefits of public spending are shared fairly between present and future generations.',
          'Every five years the Treasury shall publish a long-term fiscal sustainability report covering at least thirty years, which shall be examined by the Auditor-General.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XIV',
    title: 'Economy, Property, Trade and National Development',
    chapters: [
      chapter(
        'The Economic Order',
        art('economic-order', 'Principles of the Economic Order', [
          'The economy of Aletheia is founded on private property, free enterprise, fair competition, honest money and the rule of law, with due regard to social responsibility and the protection of the environment.',
          'The State shall ensure a predictable legal environment for lawful commercial activity, including the enforcement of contracts, the protection of creditors and the orderly resolution of insolvency.',
          'Commercial disputes may be resolved by the Court of Maritime and Commercial Disputes or by arbitration, in accordance with law.',
        ]),
        art('competition', 'Competition, Enterprises and Consumers', [
          'Agreements and practices that restrict competition, and the abuse of a dominant position, are prohibited in accordance with law.',
          'Law shall provide for companies, partnerships, cooperatives, foundations and other forms of enterprise, and for a public register of their beneficial owners.',
          'Law shall protect consumers against unsafe products, unfair terms and deceptive practices.',
        ]),
        art('strategic-sectors', 'Agriculture, Fisheries, Water and Energy', [
          'The State shall promote food security through controlled-environment agriculture, aquaculture and sustainable fisheries.',
          'The production and distribution of fresh water and the generation, storage and distribution of energy are services of public importance, which law shall regulate to ensure their safety, continuity and fair pricing.',
          'Fisheries and other uses of living marine resources shall be conducted sustainably and in accordance with international law.',
        ]),
        art('ports-trade', 'Ports, Maritime Commerce and Foreign Trade', [
          'The State may establish and operate ports and may grant concessions for port services, on published terms.',
          'Foreign trade is free, subject to law, to the obligations of the State under international agreements and to measures necessary for security, health and the protection of the environment.',
          'Customs duties may be imposed only by an Act of the Covenant Assembly.',
        ]),
        art('foreign-investment', 'Foreign Investment and Strategic Partnerships', [
          'Foreign investment is welcome in accordance with law.',
          'Law may require the screening and approval of foreign investment in critical infrastructure, sensitive technology and undertakings important to national security, under published criteria and subject to judicial review.',
          'An agreement granting a foreign State or a foreign public undertaking control over critical infrastructure in the national territory requires an Act passed by three-fifths of all members of the Covenant Assembly.',
        ]),
        art('concessions', 'Public Concessions and State Assets', [
          'Concessions for the use of public assets, platform space, marine resources or public services shall be granted only under law, through transparent and competitive procedures, for a limited period and against fair payment to the State.',
          'Every concession shall be published, together with its holder, beneficial owners, duration and payments.',
          'Public assets of significant value shall not be sold or transferred except under law and at a value certified independently.',
        ]),
        art('development', 'National Development', [
          'The Cabinet shall prepare and publish a national development plan setting out the priorities for infrastructure, energy, housing, education, health and economic development, consistent with the capital plan under [[capital-plan]].',
          'Development shall comply with the obligations of the State under [[environment]] and international maritime law.',
          'Nothing in this Part authorises any public authority to grant concessions or enforce commercial law before this Constitution has entered into force and the State has lawful jurisdiction to do so.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XV',
    title: 'Immigration, Residence and E-Residency',
    chapters: [
      chapter(
        'Entry and Residence',
        art('immigration', 'Immigration Law', [
          'The entry, residence, employment and removal of persons who are not citizens are governed by the Immigration and Residence Act, within the principles of this Part.',
          'Admission decisions shall be made under published criteria, which may include the needs of the economy and community, the ability of the applicant to support themselves, civic integration and security, and which shall not discriminate on any ground prohibited by [[equality]].',
          'The State shall control entry into the national territory at designated points of entry by sea and air, and shall verify the identity of every person entering.',
        ]),
        art('residence', 'Residence, Permanent Residence and Work Authorisation', [
          'Law shall provide for temporary residence permits, work authorisation and permanent residence.',
          'Permanent residence may be granted after a period of lawful residence fixed by law, not exceeding five years, and confers the right to live and work in the national territory without restriction of time.',
          'Permanent residence may be withdrawn only on grounds set by law, by a decision reached in accordance with [[admin-justice]].',
        ]),
        art('removal', 'Removal and Deportation', [
          'A person who is not a citizen may be removed from the national territory only in accordance with law and by a reasoned decision.',
          'The collective expulsion of persons who are not citizens is prohibited.',
          'No person shall be removed to a State where there are substantial grounds for believing that the person would face a real risk of death, torture or cruel, inhuman or degrading treatment.',
          'A person subject to a removal decision has the right of appeal to a court, which shall suspend removal where the person claims a risk under clause (3).',
        ]),
        art('asylum', 'International Protection and Stateless Persons', [
          'The State shall grant international protection to persons entitled to it under international law binding on Aletheia, in accordance with law.',
          'The State shall facilitate the status and, in accordance with [[statelessness]], the naturalisation of stateless persons lawfully in the national territory.',
        ]),
      ),
      chapter(
        'Digital Status',
        art('e-residency', 'E-Residency', [
          'The State may confer e-residency upon applicants who pass identity verification and background checks in accordance with law.',
          'E-residency confers a digital legal identity, the capacity to establish and administer undertakings registered in Aletheia, and access to the public digital services specified by law.',
          'E-residency does not confer citizenship, physical residence, a right of entry into the national territory or the right to vote. It is not a step towards citizenship and shall not be counted as residence for naturalisation.',
          'E-residency may be refused, suspended or withdrawn only under law, by a reasoned decision subject to appeal.',
        ]),
        art('digital-identity', 'Digital Identity and Fraud Prevention', [
          'The State may issue digital identity credentials to citizens, residents and e-residents in accordance with law.',
          'Identity data shall be processed in accordance with [[data-rights]] and protected by the measures required under Part XVII.',
          'Law shall establish offences and procedures for the prevention and prosecution of identity fraud.',
        ]),
        art('immigration-appeals', 'Administrative Appeals and Judicial Review', [
          'Every decision under this Part refusing, withdrawing or limiting a status shall state its reasons and the available remedies.',
          'An independent Immigration Appeals Tribunal established by law hears appeals against decisions under this Part, with a further appeal on points of law to the Court of Appeal.',
        ]),
      ),
    ],
  },
];
