import type { ScheduleSource } from '../types';

export const SCHEDULES: ScheduleSource[] = [
  {
    number: 1,
    title: 'National Symbols and Constitutional Definitions',
    basis: ['symbols', 'interpretation'],
    sections: [
      {
        heading: 'National symbols',
        clauses: [
          'The national flag (the Covenant Flag) is a field of Covenant Navy within borders of Ledger Parchment, bearing at its centre the eight-pointed Star of Truth in gold. Its proportions are two to three.',
          'The coat of arms is a quartered shield bearing the emblems of the four constituent states — a tower for St. Barbara, a book and heart for Augustine, wheat and the sun for Benedict, and a caravel on waves for St. Brendan — with an inescutcheon of Antioch, crested with the eight-pointed Star of Truth, encircled by a laurel wreath, and bearing the motto Veritas in Foedere.',
          'The Star of Truth is the eight-pointed emblem of the nation.',
          'The national seal bears the coat of arms and the words “The Sovereign Covenant State of Aletheia”. It is kept by the Chancellor and affixed to Acts, treaties and commissions as law provides.',
          'The national colours are Covenant Navy, Ledger Parchment, Seal Gold and Laurel Green.',
          'The national anthem shall be adopted by an Act of the Covenant Assembly under [[symbols(4)]].',
          'The precise specifications of the national symbols shall be set out in law.',
        ],
      },
      {
        heading: 'Definitions',
        clauses: [
          ['In this Constitution, unless the context otherwise requires:', [
            '“Act” means an Act of the Covenant Assembly promulgated under [[promulgation]];',
            '“citizen” means a citizen of Aletheia under Part IV;',
            '“constituent unit” means the Federal District of Antioch or a constituent state;',
            '“constituent state” means St. Barbara State, Augustine State, Benedict State, St. Brendan State or a state formed under [[new-states]];',
            '“fundamental right” means a right guaranteed by Part V;',
            '“law” means this Constitution, an Act, and regulations made under an Act;',
            '“national territory” means the territory of the State under [[territory]];',
            '“platform” means a fixed or floating artificial island, structure or installation at sea capable of supporting human habitation or economic activity;',
            '“public authority” means any body or person exercising public functions under law, including the federation, the constituent units, statutory agencies and state-owned undertakings when exercising public functions;',
            '“registered voter” means a person entered on the electoral register under [[franchise]];',
            '“resident” means a person lawfully residing in the national territory under Part XV.',
          ]],
        ],
      },
    ],
  },
  {
    number: 2,
    title: 'Constituent Territories and Federal Representation',
    basis: ['territory', 'establish-territory', 'electoral-system', 'council'],
    sections: [
      {
        heading: 'The constituent units',
        clauses: [
          'The Federal District of Antioch: the capital and the seat of the constitutional institutions, laid out as a concentric city around the Constitutional Plaza.',
          'St. Barbara State, with its capital at Port Michael, bearing Quarter I of the arms (the Tower): engineering, aerospace, civil protection and cybersecurity.',
          'Augustine State, with its capital at Port Luke, bearing Quarter II of the arms (the Book and Heart): the national university, medicine, research and family health.',
          'Benedict State, with its capital at San José, bearing Quarter III of the arms (Wheat and Sun): energy, water, agriculture and manufacturing.',
          'St. Brendan State, with its capital at Port Nicholas, bearing Quarter IV of the arms (the Caravel on Waves): the deepwater port, maritime trade and logistics.',
          'The mandates in this section describe the purposes for which each unit is designed. They do not restrict the activities lawfully carried on in any unit.',
        ],
      },
      {
        heading: 'Powers of the constituent units',
        clauses: [
          'Each constituent unit has a legislature and an executive, organised by its own constitution adopted in conformity with this Constitution and approved by the Council of States.',
          'Subject to federal law, the constituent units are responsible for local planning and building control within federal standards, primary and secondary schools, local public services, local roads and transit, cultural affairs, and the organisation of their own administration.',
          'The federation is responsible for all other matters, including foreign affairs, defence and security, the currency, citizenship and immigration, criminal and civil law, maritime affairs, ports, energy and water networks, the courts and the national registers.',
        ],
      },
      {
        heading: 'Representation in the Covenant Assembly',
        clauses: [
          'Each of the five constituent units elects at least five members of the Covenant Assembly.',
          'The remaining thirty-six seats are distributed among the units in proportion to their registered voters, by the method of the largest remainder, by the Electoral Commission before each general election.',
          'While fewer than five constituent units are established, the seats of the units not yet established are distributed among the established units in proportion to their registered voters.',
        ],
      },
      {
        heading: 'Representation in the Council of States',
        clauses: [
          'Each of the five constituent units elects three members of the Council of States, regardless of population.',
          'If a new constituent state is formed under [[new-states]], the number of members of the Council of States increases by three, and this Schedule shall be amended accordingly.',
        ],
      },
    ],
  },
  {
    number: 3,
    title: 'The Nine Ministries and their Responsibilities',
    basis: ['nine', 'cabinet'],
    sections: [
      {
        heading: 'The ministries',
        clauses: [
          'Ministry of Foreign Affairs and Justice: foreign relations, treaties, diplomatic and consular services, the administration of justice, the courts administration in its non-judicial aspects, prisons and legal aid.',
          'Ministry of Treasury and Finance: the Treasury, taxation and customs, the budget, public debt, public procurement policy, state-owned undertakings, financial regulation not assigned to the Reserve Bank, and liaison with the Covenant Endowment Fund.',
          'Ministry of Maritime Affairs, Ports and Environment: ports and shipping, navigation and maritime safety, the incorporation and maintenance of platforms, fisheries, the protection of the marine environment and environmental regulation.',
          'Ministry of Digital State and Registries: digital government, the national registers (citizens, title, territory, companies and religious organisations), digital identity, e-residency, public records and the Cybersecurity Department.',
          'Ministry of Resilience and Civil Protection: civilian command of the ADSS, the Police Directorate, civil protection and emergency management, border and immigration enforcement, and critical-infrastructure protection.',
          'Ministry of Infrastructure and Energy: construction standards, energy generation and networks, water production and distribution, transport, telecommunications, and the national capital plan.',
          'Ministry of Education and Science: schools, universities, vocational and maritime training, research, the national library and archives, culture and heritage, and youth.',
          'Ministry of Health and Social Well-being: public health, health care, social care, family support, disability services and charities supervision.',
          'Ministry of Economy, Trade, Agriculture and Labour: economic policy, enterprise and competition, foreign trade and investment screening, concessions policy, agriculture and food security, labour standards and consumer protection.',
        ],
      },
      {
        heading: 'Allocation',
        clauses: [
          'The Chancellor may, by a published order, allocate a function between ministries within the descriptions in this Schedule, but may not create a tenth ministry or transfer a function to a body outside the ministries and the independent institutions.',
        ],
      },
    ],
  },
  {
    number: 4,
    title: 'Constitutional Offices and Term Limits',
    basis: ['dual-duties', 'rights-scope'],
    sections: [
      {
        heading: 'Offices and terms',
        clauses: [
          'Member of the Covenant Assembly: sixty-one members; term of four years; no limit on re-election.',
          'Member of the Council of States: fifteen members; term of six years, one-third renewed every two years; no limit on re-election.',
          'Chancellor: term of five years; no more than two terms.',
          'Minister: no more than nine; serves at the pleasure of the Chancellor, subject to [[ministers]].',
          'Justice of the High Court: nine Justices; single term of twelve years; retirement at seventy-five.',
          'President of the High Court: elected by the Justices for four years, renewable once.',
          'Governor of the Reserve Bank: single term of seven years.',
          'External member of the Monetary Policy Committee: single term of six years.',
          'Director of Public Prosecutions, Commissioner of Police and heads of the independent institutions: single term of seven years.',
        ],
      },
      {
        heading: 'Offices reserved to citizens',
        clauses: [
          'The offices of Chancellor, Minister, member of the Covenant Assembly or Council of States, Justice of the High Court, Governor of the Reserve Bank, Director of Public Prosecutions, Commissioner of Police, head of the ADSS and head of an independent institution are reserved to citizens.',
        ],
      },
      {
        heading: 'Security-sensitive offices',
        clauses: [
          'The offices of Chancellor, Minister of Resilience and Civil Protection, Minister of Foreign Affairs and Justice, Governor of the Reserve Bank, Justice of the High Court, head of the ADSS, Commissioner of Police, head of the Cybersecurity Department and head of any intelligence body are security-sensitive for the purposes of [[dual-duties(4)]].',
        ],
      },
    ],
  },
  {
    number: 5,
    title: 'The Covenant Oath',
    basis: ['covenant-meaning', 'naturalisation', 'chancellor-oath'],
    sections: [
      {
        heading: 'The Covenant Oath of citizenship',
        clauses: [
          'Religious form: “I, [name], swear before Almighty God that I will be faithful to the Sovereign Covenant State of Aletheia, that I will uphold its Constitution and obey its laws, that I will respect the rights and dignity of every person, and that I will fulfil my duties as a citizen in truth and in good faith. So help me God.”',
          'Solemn form: “I, [name], solemnly and sincerely affirm that I will be faithful to the Sovereign Covenant State of Aletheia, that I will uphold its Constitution and obey its laws, that I will respect the rights and dignity of every person, and that I will fulfil my duties as a citizen in truth and in good faith.”',
        ],
      },
      {
        heading: 'The Covenant Oath for holders of constitutional office',
        clauses: [
          'Religious form: “I, [name], swear before Almighty God that I will be faithful to the Sovereign Covenant State of Aletheia, that I will uphold and defend its Constitution, that I will discharge the office of [office] truthfully, impartially and to the best of my ability, without fear or favour, for the good of all its people, and that I will never use this office for my own gain. So help me God.”',
          'Solemn form: the same words, beginning “I, [name], solemnly and sincerely affirm” and omitting the words “before Almighty God” and “So help me God”.',
          'The choice of form is that of the person taking the oath. Both forms have equal legal effect.',
        ],
      },
    ],
  },
  {
    number: 6,
    title: 'Citizenship and Nationality Principles',
    basis: ['citizenship', 'dual', 'deprivation', 'statelessness'],
    sections: [
      {
        heading: 'Principles binding on the Nationality and Citizenship Act',
        clauses: [
          'Citizenship is acquired only by birth, descent, adoption or naturalisation, and is never sold.',
          'Dual and multiple citizenship are permitted. No person is required to renounce another citizenship.',
          'Marriage does not by itself confer or remove citizenship.',
          'The law shall prevent statelessness, particularly of children.',
          'Citizenship acquired by birth or descent cannot be revoked. Citizenship acquired by naturalisation may be revoked only for fraud, by a court, within ten years.',
          'Every decision on citizenship is reasoned, in writing and subject to appeal and judicial review.',
          'All citizens are equal, however their citizenship was acquired.',
        ],
      },
      {
        heading: 'Matters for the Nationality and Citizenship Act',
        clauses: [
          'The Act shall provide for: the documents required for applications; the content and assessment of civic integration; the definition of good character; registration of births abroad; the procedure for renunciation and restoration; the fees for applications, which shall not exceed the cost of administration; and the protection of citizenship records.',
        ],
      },
    ],
  },
  {
    number: 7,
    title: 'Legislative Procedure',
    basis: ['ordinary-procedure', 'council-powers', 'consent-bills', 'financial-legislation'],
    sections: [
      {
        heading: 'Stages of a bill in the Covenant Assembly',
        clauses: [
          'First reading: the bill is introduced, published with its explanatory memorandum and referred to the responsible committee.',
          'Committee stage: the committee examines the bill, holds any required public hearing and reports, with any amendments, within the period set by the rules of procedure.',
          'Second reading: the Assembly debates the bill and votes on amendments.',
          'Final vote: the Assembly votes on the bill as a whole, not earlier than fourteen days after the first reading, save as [[ordinary-procedure(3)]] permits.',
        ],
      },
      {
        heading: 'Classes of bills',
        clauses: [
          'A financial bill is the Budget Bill, a supplementary appropriation bill, or a bill whose sole or principal purpose is to impose, alter or abolish a tax or charge or to authorise borrowing.',
          'A land, energy or currency bill is a bill whose principal purpose concerns title to platforms or platform space, ground leases or concessions; energy generation and networks; or the currency, the Reserve Bank or the monetary framework.',
          'A consent bill is a bill described in [[consent-bills(1)]].',
          'Every other bill is an ordinary bill.',
        ],
      },
      {
        heading: 'Disagreement between the chambers',
        clauses: [
          'Where the Council of States returns an ordinary bill or a land, energy or currency bill, the Speaker shall publish its objections. The Covenant Assembly may amend the bill to meet them, in which case it is sent again to the Council of States, or may pass it again under [[council-powers(2)]].',
          'The Speaker of the Covenant Assembly certifies the class of each bill on its introduction. A dispute about the certification may be referred by the President of the Council of States to the High Court, which shall decide within thirty days.',
        ],
      },
    ],
  },
  {
    number: 8,
    title: 'Emergency Powers',
    basis: ['emergency', 'emergency-limits', 'limits'],
    sections: [
      {
        heading: 'Non-derogable rights',
        clauses: [
          ['The following rights may not be limited or suspended at any time, including in a state of emergency:', [
            'the inviolability of human dignity and the right to life ([[dignity]]);',
            'the prohibition of torture, of cruel, inhuman or degrading treatment, and of slavery and servitude ([[torture]]);',
            'the prohibition of retroactive criminal offences and penalties, and the presumption of innocence ([[criminal-rights]]);',
            'freedom of thought, conscience and religion, save that public manifestation may be limited under [[emergency-limits(1)]] ([[conscience]]);',
            'the right not to be deprived of citizenship save under [[deprivation]];',
            'the right to have the lawfulness of detention decided by a court ([[liberty(4)]]);',
            'the right to an effective remedy before a court for the violation of any non-derogable right ([[due-process(3)]]).',
          ]],
        ],
      },
      {
        heading: 'Proclamations',
        clauses: [
          'A proclamation of a state of emergency shall state: the grounds; the area affected; the measures authorised, by reference to the provisions of law they rely on; the fundamental rights limited and the reasons; the duration; and the authorities responsible.',
          'Each extension shall be accompanied by a report on the measures taken and the reasons why the emergency continues.',
        ],
      },
    ],
  },
  {
    number: 9,
    title: 'Constitutional Amendment Procedures and Entrenched Provisions',
    basis: ['amend-ordinary', 'amend-entrenched'],
    sections: [
      {
        heading: 'Summary of procedures',
        clauses: [
          'Ordinary amendment: two-thirds of all members of the Covenant Assembly, with ninety days between first reading and final vote, and two-thirds of all members of the Council of States ([[amend-ordinary]]).',
          'Federal amendment: as for an ordinary amendment, with the consent of the legislature of each affected constituent unit ([[amend-ordinary(2)]]).',
          'Entrenched amendment: as for an ordinary amendment, followed by approval in a national referendum by a majority of votes cast and a majority of voters in a majority of the constituent units ([[amend-entrenched]]).',
        ],
      },
      {
        heading: 'Entrenched provisions',
        clauses: [
          ['The following provisions are entrenched:', [
            '[[nature]] (Nature of the Sovereign Covenant State) and [[name]] (Name and Constitutional Identity);',
            '[[supremacy]] (Supremacy of the Constitution) and [[separation]] (Separation of Powers);',
            '[[heritage]] (Christian Heritage of Aletheia);',
            '[[citizenship]] (Citizenship and its Foundations) and [[dual]] (Dual and Multiple Citizenship);',
            '[[limits]] (Limitation of Fundamental Rights) and every right listed as non-derogable in Schedule 8;',
            '[[chancellor-election(3)]] (limit of two terms for the Chancellor);',
            '[[high-court]] and [[justices-tenure]] (composition of the High Court and tenure of the Justices);',
            '[[nine]] (Limitation of Ministries to Nine Portfolios);',
            '[[rba-independence]] (Independence of the Reserve Bank) and [[no-monetary-finance]] (Prohibition of Monetary Financing);',
            '[[taxation(2)]] (no tax on personal income, capital gains or inheritances);',
            'Part XX (Emergency Powers) and Part XXI (Constitutional Amendments).',
          ]],
          'The purpose of each entrenchment is to protect a foundation of the national covenant — its identity, the rights of its people, the limits on power, honest money and the stability of its institutions — so that it can be changed only by the people themselves.',
        ],
      },
    ],
  },
  {
    number: 10,
    title: 'Transitional Implementation Framework',
    basis: ['founding-phase', 'convention', 'effect', 'first-institutions', 'transfer'],
    sections: [
      {
        heading: 'The Constitutional Convention',
        clauses: [
          'The Constitutional Convention consists of delegates elected by the founding members registered under the founding-member procedure published by the founding administration, in accordance with rules adopted and published by the founding administration at least ninety days before the election.',
          'The Convention adopts its own rules of procedure, elects its presiding officer and decides by a majority of two-thirds of its delegates on the final text to be submitted for ratification.',
        ],
      },
      {
        heading: 'Ratification and the first citizens',
        clauses: [
          'The persons entitled to vote in the ratification referendum are the founding members of full age who have been verified as to identity and enrolled on the founding register by the date set by the Convention.',
          'On entry into force, the first citizens are the persons on the founding register who, within twelve months, take the Covenant Oath and are verified by the Registrar General, together with their minor children. Thereafter, citizenship is acquired only under Part IV.',
          'The Register of Citizens is established when the Registrar General, appointed ad interim by the Convention, certifies that the register has been opened under law.',
        ],
      },
      {
        heading: 'Interim institutions',
        clauses: [
          'The Convention appoints an Auditor-General ad interim and an independent electoral body ad interim, whose terms end when their constitutional successors take office.',
          'Until the constituent units are established, the Council of States consists of fifteen members elected by the citizens in a single national constituency by proportional representation, for a term ending when the members for the first established units take office.',
          'Until the Federal District is established, the constitutional institutions sit at a place determined by the Convention.',
        ],
      },
      {
        heading: 'Timetable after entry into force',
        clauses: [
          'Within six months: first elections to the Covenant Assembly, the Council of States and the office of Chancellor.',
          'Within twelve months: appointment of the first nine Justices of the High Court. Of the first Justices, three are appointed for four years, three for eight years and three for twelve years, as determined by lot at the first sitting; none of them may be reappointed.',
          'Within twelve months: establishment of the Treasury, the Covenant Endowment Fund and the independent institutions.',
          'Within eighteen months: establishment of the Reserve Bank and publication of its first monetary framework. No currency may be issued as legal tender before [[guilder(4)]] is satisfied.',
        ],
      },
      {
        heading: 'Public disclosure during the transition',
        clauses: [
          'The founding administration, and after entry into force the Cabinet, shall publish and keep current the classification required by [[founding-phase(2)]], stating for each institution whether it is proposed, operating as a founding-phase structure, or established under this Constitution.',
        ],
      },
    ],
  },
];
