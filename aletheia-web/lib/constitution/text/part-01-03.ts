import { art, chapter, type PartSource } from '../types';

export const PREAMBLE: string[] = [
  'We, the founding members of the Sovereign Covenant State of Aletheia, gathered in freedom and bound by a common purpose,',
  'Taking our name from the Greek word for truth that is not hidden, and resolved that the public power of our State shall be exercised in the open, recorded faithfully and answerable to the people from whom it derives;',
  'Acknowledging with gratitude the Christian heritage from which our moral foundations, our respect for the dignity of every person and our understanding of covenant are drawn, and desiring that this heritage shall remain the living inheritance of the nation;',
  'Holding that every human being bears an inherent dignity which no government confers and no government may take away, and that the family, the community and the free association of citizens are the first schools of responsibility and mutual care;',
  'Determined that those who hold public office shall hold it as a trust under covenant, bound by oath to serve the common good, to tell the truth and to keep faith with those who entrust them with authority;',
  'Resolved to govern ourselves by democratic means under the supremacy of this Constitution, with powers separated, limited and subject to the judgment of independent courts;',
  'Purposing to establish, by lawful means and with respect for the rights of all nations, a maritime homeland built and owned by our own labour, and to be faithful stewards of the sea, its life and its resources for the generations who will follow us;',
  'Committed to honest money, prudent public finances and institutions whose every account may be examined;',
  'And seeking to found a peaceful, resilient and self-governing national community, at peace with its neighbours and faithful to the law of nations;',
  'Do hereby propose this Constitution, to be adopted and ratified in accordance with its own provisions, as the Covenant of Aletheia.',
  'Veritas in Foedere — Truth in Covenant.',
];

/** Printed under the Preamble so that ideals are never read as present facts. */
export const PREAMBLE_NOTE =
  'This Preamble states the founding ideals of Aletheia. It describes a State that is proposed, not one that exists. Until this Constitution enters into force under [[effect]], it confers no authority, territory or status on any person or body.';

export const PARTS_I_III: PartSource[] = [
  {
    numeral: 'I',
    title: 'Foundational Principles and National Identity',
    chapters: [
      chapter(
        'The State and its Constitution',
        art('nature', 'Nature of the Sovereign Covenant State', [
          'The Sovereign Covenant State of Aletheia is a federal democratic republic and a European-oriented maritime nation, founded on truth, covenant, the Christian heritage of its people and the rule of law.',
          'Supreme authority in the Sovereign Covenant State resides in this Constitution, ratified by its citizens and the constituent states in accordance with [[ratification]].',
          'The Sovereign Covenant State adopts as its governing method the principle of Aletheia, truth that is not hidden: public records, enacted laws, public appropriations and official registers shall be kept so that their integrity can be verified, in accordance with Part XVII.',
          'The Sovereign Covenant State is founded as a seasteading state. Its territory consists of the platforms, structures and installations that it lawfully builds, acquires and owns, as provided in Part III.',
        ]),
        art('name', 'Name and Constitutional Identity', [
          'The name of the State is the Sovereign Covenant State of Aletheia. In ordinary use it may be called Aletheia.',
          'The name of the State may be changed only by an amendment adopted under the procedure for entrenched provisions in [[amend-entrenched]].',
          'No person, body or undertaking may use the name, arms or seal of the State so as to suggest that it acts with public authority when it does not.',
        ]),
        art('supremacy', 'Supremacy of the Constitution', [
          'This Constitution is the supreme law of the Sovereign Covenant State.',
          'An Act, regulation, decree, administrative rule or decision that is inconsistent with this Constitution is void to the extent of the inconsistency.',
          'The High Court shall have final authority to determine whether any law or act is inconsistent with this Constitution, in accordance with Part XI.',
          'Every public authority, official and court is bound by this Constitution and shall apply it directly.',
        ]),
        art('sovereignty', 'Popular Sovereignty and Democratic Legitimacy', [
          'All public power derives from the citizens of Aletheia and shall be exercised only in the forms and within the limits that this Constitution provides.',
          'The citizens exercise their sovereignty through elections, through referendums held under this Constitution and through their elected representatives.',
          'No person or group may claim to exercise public power in the name of the people except under this Constitution.',
        ]),
        art('rule-of-law', 'The Rule of Law', [
          'Every exercise of public power shall have a basis in law, shall be exercised for the purpose for which it was conferred and shall be subject to review by an independent court.',
          'Laws shall be published, accessible, sufficiently clear to be foreseeable in their effect and, save as this Constitution permits, prospective.',
          'No person is above the law. Every public official is personally answerable under law for unlawful acts done in office, subject only to the immunities expressly provided by this Constitution.',
        ]),
        art('separation', 'Separation of Powers', [
          'Legislative power is vested in the Covenant Assembly and, to the extent this Constitution provides, the Council of States.',
          'Executive power is vested in the Chancellor and the Cabinet.',
          'Judicial power is vested in the High Court and the courts established by law under Part XI.',
          'No branch shall exercise a power vested in another, except as this Constitution expressly provides. No person may hold office in more than one branch at the same time.',
        ]),
        art('accountability', 'Public Accountability and Open Government', [
          'Public authorities shall act openly. Their decisions, the reasons for them and the public money spent in giving effect to them shall be recorded and, save as law permits for the protection of personal data, security or the rights of others, published.',
          'Every public office is a public trust. A holder of public office shall not use the office, or information obtained through it, for private gain.',
          'The independent institutions established by Part XIX shall have the powers necessary to hold public authorities to account.',
        ]),
        art('loyalty', 'National Unity and Constitutional Loyalty', [
          'The Sovereign Covenant State is one and indivisible. The constituent states exercise their powers within the federation and under this Constitution.',
          'Every citizen owes loyalty to the Sovereign Covenant State and fidelity to this Constitution. Loyalty under this Article does not require any person to hold or profess any belief, and is consistent with lawful dissent, peaceful opposition and advocacy for constitutional change.',
        ]),
        art('federation', 'The State and the Constituent Territories', [
          'The Sovereign Covenant State is composed of the Federal District of Antioch and the constituent states established under Part III.',
          'The constituent states possess the powers of self-government that this Constitution and Schedule 2 allocate to them. Powers not allocated to a constituent state are exercised by the federation.',
          'Federal law prevails over the law of a constituent state where the two conflict on a matter within federal competence.',
          'The federation shall respect the identity and self-government of each constituent state and shall consult the states, through the Council of States, on matters that particularly affect them.',
        ]),
      ),
      chapter(
        'National Symbols, Language and Calendar',
        art('symbols', 'National Symbols', [
          'The national motto is Veritas in Foedere — Truth in Covenant.',
          'The flag, the coat of arms, the Star of Truth, the national seal and the national anthem of the Sovereign Covenant State are as described in Schedule 1.',
          'The national symbols belong to the nation. Their use shall be regulated by law, and they shall not be used for commercial or partisan purposes without lawful authorisation.',
          'The national symbols may be altered only by an Act passed by two-thirds of all members of the Covenant Assembly with the consent of the Council of States.',
        ]),
        art('languages', 'Official Languages and Equal Access', [
          'The official languages of the Sovereign Covenant State are English, German, Dutch, Serbian and Italian.',
          'English is the working language of the Covenant Assembly, the superior courts and official protocol. Where the texts of a law differ between official languages, the English text prevails.',
          'Every citizen, resident and e-resident has the right to communicate with any public authority in any official language and to receive a decision in that language within the time that law prescribes.',
          'The State shall provide interpretation in criminal proceedings to any person who does not understand the language of the court, free of charge.',
          'Law may provide for the protection and teaching of the languages spoken by the citizens of Aletheia.',
        ]),
        art('calendar', 'Calendar and Official Records', [
          'The Gregorian calendar is the official calendar of the Sovereign Covenant State. Official dates are recorded in Coordinated Universal Time unless law provides otherwise.',
          'Official records shall be kept in a durable form, in at least one official language, and in a manner that permits their integrity to be verified under Part XVII.',
        ]),
        art('capital', 'The National Capital', [
          'The capital of the Sovereign Covenant State is Antioch, which shall be constituted as the Federal District.',
          'The Covenant Assembly, the Council of States, the Chancellery and the High Court shall have their seats in Antioch once the Federal District is established under [[establish-territory]].',
          'Until the Federal District is established, the seats of the constitutional institutions shall be determined under Part XXII.',
        ]),
        art('holidays', 'Public Holidays and National Commemorations', [
          'The public holidays of the Sovereign Covenant State shall include Christmas Day, Good Friday, Easter Monday and Covenant Day, the anniversary of the entry into force of this Constitution.',
          'Further public holidays and national commemorations may be established by law.',
          'Members of every religion and belief shall be entitled, in accordance with law, to reasonable arrangements for the observance of their own holy days.',
        ]),
      ),
      chapter(
        'Interpretation',
        art('interpretation', 'Constitutional Interpretation', [
          'This Constitution shall be interpreted as a whole, according to the ordinary meaning of its words in their context and in the light of its purposes, including those stated in the Preamble.',
          'Where a provision is capable of more than one meaning, the meaning that best protects human dignity, the fundamental rights in Part V and the separation of powers shall be preferred.',
          'The Preamble and the headings of Parts, Chapters and Articles may be used as aids to interpretation but do not create rights or powers.',
          'Words in the singular include the plural and the plural the singular; words referring to any gender include every person.',
          'The terms defined in Schedule 1 have the meanings given there.',
        ]),
      ),
    ],
  },
  {
    numeral: 'II',
    title: 'Christian Heritage, Religion and the Public Order',
    chapters: [
      chapter(
        'The Christian Foundation of the Nation',
        art('heritage', 'Christian Heritage of Aletheia', [
          'Aletheia is founded upon the Christian heritage of its people. The moral teaching of that heritage — the dignity of every person, truthfulness, the keeping of covenants, mercy, justice and care for the weak — forms the foundation of the national covenant.',
          'The Christian heritage of Aletheia is part of its constitutional identity. The State shall honour, preserve and transmit that heritage through its public life, national symbols, calendar, education and cultural institutions, as this Constitution and law provide.',
          'The Sovereign Covenant State does not establish any church or denomination as a State church. No church is an organ of the State, and the State shall not govern the internal affairs of any church.',
          'Recognition of the Christian heritage does not diminish the rights guaranteed to every person by Part V, and shall not be invoked to justify any action that this Constitution otherwise prohibits.',
        ]),
        art('covenant-meaning', 'The Civic Meaning of the National Covenant', [
          'The national covenant is the solemn bond between the citizens of Aletheia and the State, by which citizens undertake to uphold this Constitution and to serve the common good, and the State undertakes to govern justly, truthfully and within the law.',
          'The Covenant Oath in Schedule 5 gives expression to the national covenant. It may be taken in a religious or in a solemn non-religious form, which are of equal legal effect.',
        ]),
        art('institutions-christian', 'Christian Institutions and Community Life', [
          'The State recognises the historic contribution of Christian churches, charitable foundations, schools, hospitals and associations to the common good.',
          'The State may cooperate with churches and religious organisations by agreements concluded under law for purposes of public benefit, including education, health, social care, the relief of poverty and the care of heritage. Such agreements shall be published and laid before the Covenant Assembly.',
          'Public funding under an agreement made under this Article shall be granted for defined public purposes, accounted for under Part XIII and awarded on criteria set by law.',
        ]),
        art('heritage-sites', 'Historic Christian Sites and National Religious Heritage', [
          'The State shall protect the Christian heritage of the nation, including churches, chapels, monuments, works of art, archives and other sites and objects of historic or religious significance designated by law.',
          'Law may designate civic heritage zones in which the architecture, monuments and public spaces express the national heritage described in [[heritage]]. Design rules for a civic heritage zone shall be published, shall apply to every building in the zone, and shall be reviewable by the courts.',
          'Property belonging to the national religious heritage that is held by the State shall be administered in trust for the nation and shall not be alienated except under an Act of the Covenant Assembly.',
        ]),
        art('officials-heritage', 'Public Officials and the Founding Identity', [
          'Holders of public office shall respect the Christian heritage and founding identity of the nation in the performance of their public duties and in the conduct of State ceremonies.',
          'No holder of public office shall be required to profess, practise or renounce any religion or belief as a condition of holding office, and no religious test shall be imposed for any public office.',
          'Public officials shall serve every person without discrimination on the grounds of religion or belief.',
        ]),
        art('christian-law', 'Christian Principles, Civil Law and Judicial Review', [
          'The civil law of Aletheia is made by the Covenant Assembly in accordance with this Constitution. Christian ethical principles inform the law of Aletheia; they are not themselves a source of law enforceable against any person except as enacted by law.',
          'Every law, including a law adopted in reliance on the Christian heritage of the nation, is subject to judicial review for its consistency with this Constitution.',
        ]),
      ),
      chapter(
        'Religious Organisations',
        art('religious-orgs', 'Legal Status and Registration of Religious Organisations', [
          'A church or religious organisation may acquire legal personality by registration in the Register of Religious Organisations under law.',
          'Law shall set objective and published conditions for registration, which shall apply equally to every applicant. Those conditions may include a minimum number of adult members who are citizens or permanent residents, a written constitution, the identification of the persons responsible for the organisation, and a commitment to respect this Constitution and the rights of others.',
          'A refusal of registration shall state its reasons and is subject to appeal to the courts.',
          'Persons who do not form a registered organisation retain the freedom of religion guaranteed by [[conscience]], including the right to worship together in private.',
        ]),
        art('religious-autonomy', 'Internal Governance and General Law', [
          'A religious organisation governs its own internal affairs, including its doctrine, worship, membership, ministry and the appointment of its ministers, without interference by the State.',
          'A religious organisation is subject to the general law in all other respects, including the criminal law, the law of contract, employment and property, the protection of children and vulnerable adults, data protection, building safety and the law relating to charities.',
          'The autonomy of a religious organisation does not exempt any person from criminal liability or from the duty to report abuse that law imposes.',
        ]),
        art('religious-finance', 'Financial Transparency and Foreign Funding', [
          'A registered religious organisation shall keep proper accounts and shall publish annual accounts in the form that law prescribes.',
          'Every gift, loan or other funding exceeding a threshold set by law that a religious organisation receives from a source outside Aletheia shall be reported to the Register of Religious Organisations and published.',
          'Law may prohibit funding from a foreign State or foreign public authority, or from a person listed under law for involvement in terrorism or serious crime, and may require funding received in breach of the law to be returned or forfeited.',
          'The requirements of this Article apply equally to every religious organisation and to every other association that receives foreign funding above the same threshold.',
        ]),
        art('religious-safeguards', 'Safeguards Against Abuse of Religious Freedom', [
          'No person may, under the cover of religion: coerce any person to join, remain in or leave a religion; obtain money or property by fraud or undue influence; incite violence, hatred or discrimination against any person; or direct a religious organisation in Aletheia on behalf of a foreign State in breach of law.',
          'A registered religious organisation that persistently and seriously engages in conduct described in clause (1), or whose purposes or activities are directed to the overthrow of this Constitution by force, may be deregistered and, where necessary, dissolved by order of the High Court on the application of the Attorney-General.',
          'Proceedings under clause (2) shall be heard in public unless the Court orders otherwise, and the organisation shall have the right to be represented and heard.',
        ]),
        art('places-worship', 'Places of Worship and Assembly', [
          'A registered religious organisation may establish and maintain places of worship, subject to the general law.',
          'Every place of worship and every other building used for public assembly is subject to the same law on planning, construction, structural and fire safety, maritime safety, environmental protection, noise and occupancy as any other building of comparable size and use.',
          'The planning, design and heritage rules that apply to a place of worship, including the rules for a civic heritage zone under [[heritage-sites(2)]], shall be published in advance and applied consistently to comparable buildings.',
          'No law or decision shall prohibit or restrict the places of worship of a particular religion by naming that religion or by any criterion designed to affect that religion alone. A restriction on places of worship is lawful only if it satisfies [[limits]].',
        ]),
        art('public-property', 'Religious Heritage and Public Property', [
          'Public land, platform space and buildings shall be allocated for religious, charitable or community use only under published criteria and by decisions that are recorded and reviewable.',
          'The State may maintain chapels and places of prayer in public institutions such as hospitals, schools, prisons and the Aletheian Defence & Security Service, and shall make reasonable arrangements for persons of other faiths in those institutions.',
        ]),
      ),
    ],
  },
  {
    numeral: 'III',
    title: 'Territory, Maritime Jurisdiction and the Seastead',
    chapters: [
      chapter(
        'The Territory of the State',
        art('territory', 'The Territory', [
          'The territory of the Sovereign Covenant State consists of the platforms, artificial islands, structures and installations that the State lawfully builds, acquires and owns, together with any land that it lawfully acquires with full title, as established under [[establish-territory]] and recorded in the Register of National Territory.',
          'Within the territory there shall be the Federal District of Antioch and the four constituent states: St. Barbara State, Augustine State, Benedict State and St. Brendan State.',
          'The Federal District of Antioch is the capital and the seat of the constitutional institutions.',
          'The Sovereign Covenant State shall not lease its territory from a foreign State, and no part of the national territory shall be held under an arrangement that permits another State to reclaim it.',
          'A declaration made under this Constitution does not by itself create sovereignty over any area. The territory exists only to the extent that it has been lawfully established in fact and in law.',
        ]),
        art('establish-territory', 'Establishment of the Territory and the Constituent Units', [
          'A platform, structure or parcel of land becomes part of the national territory when: (a) the State holds full and unencumbered title to it; (b) it has been certified as fit for its purpose under the law on construction and maritime safety; and (c) its incorporation has been approved by an Act of the Covenant Assembly and recorded in the Register of National Territory.',
          'The Federal District and each constituent state shall be established by an Act of the Covenant Assembly, with the consent of the Council of States, defining its platforms and boundaries.',
          'Until a constituent state is established, its name and mandate remain as described in Schedule 2 and confer no rights or powers.',
        ]),
        art('new-states', 'Expansion and New Constituent Territories', [
          'New platforms may be incorporated into an existing constituent unit, or new constituent states may be formed, by an Act of the Covenant Assembly passed by two-thirds of all members with the consent of two-thirds of all members of the Council of States.',
          'The boundaries of a constituent state may not be altered without the consent of its legislature, and, where law so provides, of its residents in a referendum.',
          'Representation in the Covenant Assembly and the Council of States shall be adjusted under Schedule 2 when a new constituent state is formed.',
        ]),
        art('boundary-disputes', 'Disputes Concerning Boundaries and Title', [
          'Disputes between the federation and a constituent state, or between constituent states, concerning boundaries, title to platforms or the allocation of territory shall be determined by the High Court.',
          'Disputes with other States concerning title, navigation or the use of the sea shall be settled by peaceful means in accordance with [[peaceful-settlement]].',
        ]),
      ),
      chapter(
        'Platforms, Structures and Maritime Jurisdiction',
        art('platform-status', 'Legal Status of Platforms, Installations and Vessels', [
          'Law shall distinguish between: (a) platforms, artificial islands and fixed structures forming part of the national territory; (b) installations held or operated by the State under contract but not forming part of the national territory; and (c) vessels.',
          'A vessel is not part of the national territory. A vessel may fly the flag of Aletheia only when Aletheia is able lawfully to grant its nationality to ships, and then only under a law that ensures a genuine link between the State and the ship, as international law requires.',
          'The rights and obligations of the State in respect of any platform, structure or installation are those that international law confers. This Constitution does not enlarge them.',
        ]),
        art('maritime-limits', 'Maritime Jurisdiction and the Limits of International Law', [
          'The Sovereign Covenant State shall claim no maritime zone beyond what the United Nations Convention on the Law of the Sea and other applicable international law allow.',
          'The State acknowledges that artificial islands, installations and structures do not possess the status of islands, have no territorial sea of their own and generate no exclusive economic zone or continental shelf.',
          'The State shall site no platform, structure or installation in the territorial sea, exclusive economic zone or continental shelf of another State without that State’s consent, and shall respect the rights of other States and their nationals at sea.',
          'Any safety zone around a platform, structure or installation shall be established only to the extent permitted by international law, and shall not interfere with recognised sea lanes essential to international navigation.',
        ]),
        art('navigation', 'Maritime Safety and Navigational Access', [
          'The State shall ensure that its platforms, structures and installations are marked, lit, charted and operated in accordance with international maritime safety standards.',
          'The State shall respect the freedom of navigation of all ships around its platforms, outside any lawful safety zone, and shall render assistance to any person in danger at sea.',
        ]),
        art('environment', 'Protection of the Marine Environment', [
          'The State shall protect and preserve the marine environment and its biodiversity, and shall prevent, reduce and control pollution from its platforms, vessels and activities.',
          'No platform, structure or installation shall be built, extended or decommissioned without a published environmental impact assessment approved under law.',
          'Discharges of untreated sewage, industrial effluent and plastics into the sea from the national territory are prohibited. Law shall set limits for all other discharges.',
          'Environmental monitoring data collected by public authorities shall be published as open data.',
          'A platform that reaches the end of its service life shall be decommissioned and removed, or made safe, in accordance with international standards and at the cost of its owner.',
        ]),
      ),
      chapter(
        'Land, Platform Space and Infrastructure',
        art('title-register', 'Registration of Title', [
          'There shall be a Register of National Territory and a Register of Title, in which every platform, parcel of platform space and interest in it shall be recorded.',
          'Title is established by registration under law. A record on a distributed ledger or other verification system is evidence of a registered entry but does not by itself create, transfer or extinguish title.',
          'The Registers shall be public, save that personal data shall be protected in accordance with [[data-rights]].',
        ]),
        art('ground-leases', 'Public Land, Private Holdings, Concessions and Ground Leases', [
          'The platforms forming the national territory are held by the State in trust for the nation. Platform space may be granted to persons and undertakings by ground lease, licence or concession on terms published and recorded in the Register of Title.',
          'Ground rents and concession revenues are public revenues and shall be paid into the Consolidated Fund or the Covenant Endowment Fund as Part XIII provides.',
          'A ground lease shall be for a fixed term, shall state the permitted use and the rent, and may be terminated before its term only on grounds and by procedures set by law, with compensation where [[property]] so requires.',
          'The terms of ground leases shall be set by law on objective and published criteria, and shall not discriminate between applicants on any ground prohibited by [[equality]].',
        ]),
        art('corridors', 'Infrastructure Corridors, Ports, Energy and Telecommunications', [
          'The State may reserve platform space for infrastructure corridors, ports, energy generation and storage, water production, telecommunications and other public utilities.',
          'Critical infrastructure shall be planned, built and operated to published standards of safety, resilience and redundancy, and its protection is governed by Part XVI.',
        ]),
        art('acquisition', 'Lawful Acquisition of Territory and Infrastructure', [
          'The State may acquire territory and infrastructure only by lawful means: by construction, by purchase with full title, by gift or by other lawful transfer, in each case in accordance with international law and the law of any State in which the acquisition takes place.',
          'Every acquisition of territory or of infrastructure above a value set by law shall be approved by an Act of the Covenant Assembly, published and recorded in the Register of National Territory.',
          'The State shall not acquire or claim any area by force, by the threat of force or by unilateral declaration.',
        ]),
        art('evacuation', 'Evacuation, Relocation and Continuity of Government at Sea', [
          'The State shall maintain published plans for the evacuation of persons from any platform, for the temporary relocation of residents and for the continuity of the constitutional institutions in the event of storm, fire, structural failure or other emergency.',
          'If the seat of a constitutional institution cannot be used, the institution may meet or sit at any other place, within or outside the national territory, determined under law or, in an emergency, by the presiding officer of the institution.',
          'Measures taken under this Article are subject to Part XX.',
        ]),
      ),
    ],
  },
];
