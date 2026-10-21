import { art, chapter, type PartSource } from '../types';

export const PARTS_XVI_XXIII: PartSource[] = [
  {
    numeral: 'XVI',
    title: 'ADSS, Police, Civil Protection and National Security',
    chapters: [
      chapter(
        'The Security Institutions',
        art('adss', 'The Aletheian Defence & Security Service', [
          'There is established the Aletheian Defence & Security Service (ADSS), responsible, in accordance with law, for the defence of the national territory, maritime safety and protection, search and rescue, civil protection and disaster response, border and immigration enforcement, and the protection of critical infrastructure.',
          'The ADSS is under the civilian command of the Minister of Resilience and Civil Protection, who is accountable to the Covenant Assembly for it. The Chancellor is the supreme commander of the ADSS.',
          'The organisation, functions, powers and discipline of the ADSS are governed by the ADSS Act. The ADSS may exercise only the powers that law confers on it.',
          'Members of the ADSS shall be politically neutral. They may not be members of a political party while in service.',
        ]),
        art('police', 'The Police', [
          'There is established a Police Directorate, responsible for civilian law enforcement, the prevention and investigation of crime, and the protection of persons and their rights.',
          'The Police Directorate is institutionally distinct from the ADSS. No part of the ADSS shall exercise general police powers over the civilian population, save as [[internal-deployment]] provides.',
          'The Police Directorate is headed by a Commissioner of Police, appointed by the Cabinet after a public hearing before the Covenant Assembly for a single term of seven years, and removable only for cause by the procedure that applies to a judge of the Court of Appeal.',
        ]),
        art('use-of-force', 'Lawful Use of Force and Human-Rights Protection', [
          'Members of the ADSS and the police may use force only when strictly necessary and proportionate to a lawful purpose. Lethal force may be used only where strictly unavoidable to protect life.',
          'Every use of force causing death or serious injury, and every death in custody, shall be investigated by the Police and Security Conduct Office of the Ombudsman, whose findings shall be published.',
          'No order to commit an unlawful act shall be obeyed, and obedience to orders is no defence to a charge of torture, unlawful killing or any crime under international law.',
          'Every person whose rights are violated by a member of the ADSS or the police is entitled to a remedy before the courts.',
        ]),
        art('internal-deployment', 'Deployment Among the Civilian Population', [
          'The ADSS may be deployed to assist the civil authorities within the national territory: (a) in response to a natural disaster, accident or other emergency, at the request of the civil authorities; (b) for search and rescue; and (c) in a state of emergency declared under Part XX, in the manner and for the purposes stated in the declaration.',
          'No security service may be deployed for law enforcement against the civilian population except under a state of emergency approved by the Covenant Assembly under Part XX.',
          'When deployed under this Article, members of the ADSS act under the direction of the civil authorities, are bound by the same legal limits as the police, and are accountable before the civilian courts.',
          'The ADSS shall not be used to influence elections, to suppress peaceful assembly or to act against any person for political reasons.',
        ]),
        art('intelligence', 'Intelligence Functions', [
          'Intelligence functions may be conducted only by a body established by law, attached to a ministry in Schedule 3, with functions confined to the protection of national security as defined by law.',
          'Every intelligence operation that interferes with privacy requires a warrant under [[surveillance]].',
          'No intelligence body may exercise powers of arrest or detention.',
        ]),
        art('security-oversight', 'Parliamentary and Independent Security Oversight', [
          'The committee on security and intelligence of the Covenant Assembly oversees the ADSS, the police and any intelligence body. Its members have access to classified information, subject to the obligation of confidentiality.',
          'The ADSS, the Police Directorate and any intelligence body shall report to the committee at least twice each year and publish an annual public report.',
          'The Police and Security Conduct Office, established by law within the Ombudsman, investigates complaints and serious incidents involving the ADSS and the police, independently of both.',
          'The Minister of Resilience and Civil Protection, the head of the ADSS and the Commissioner of Police shall not direct any operation for a political purpose, and any attempt to do so is a criminal offence.',
        ]),
      ),
      chapter(
        'Civil Protection and Critical Infrastructure',
        art('civil-protection', 'Civil Protection and Emergency Coordination', [
          'The State shall maintain a national system of civil protection and emergency management, including published plans for storms, fire, flooding, structural failure, pandemics, infrastructure failure and cyber incidents.',
          'The Minister of Resilience and Civil Protection coordinates the response of all public authorities to emergencies, within the law and subject to Part XX.',
          'Emergency plans and the results of exercises shall be published, save for information whose disclosure would endanger public safety.',
        ]),
        art('critical-infrastructure', 'Protection of Critical Infrastructure', [
          'Law shall designate critical infrastructure, including energy, water, communications, ports, payment systems and the digital systems of the State, and shall require its operators to meet standards of security and resilience.',
          'The operators of critical infrastructure shall report serious incidents to the competent authorities without delay.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XVII',
    title: 'Cybersecurity, Digital Government and Public Records',
    chapters: [
      chapter(
        'Cybersecurity',
        art('cyber', 'The Aletheian Cybersecurity Department', [
          'There is established the Aletheian Cybersecurity Department, a permanent agency attached to the Ministry of Digital State and Registries, charged with the protection of the networks and information systems of the State, the validators and registers of public record, identity systems and maritime telemetry.',
          'The Department operates the National Computer Emergency Response Team and administers a public coordinated vulnerability disclosure programme, under which persons who report vulnerabilities in good faith are protected from liability.',
          'The Department has no power to conduct general surveillance of the population, which is prohibited by [[surveillance]]. It may access the content of private communications only under a warrant issued under that Article.',
          'The Department shall publish an annual report on the security of public systems and the incidents that affected them.',
        ]),
        art('cyber-standards', 'Cybersecurity Standards, Incidents and Audit', [
          'The digital systems of the State shall meet cybersecurity standards published by the Cybersecurity Department.',
          'Every public authority and operator of critical infrastructure shall report significant cyber incidents to the National Computer Emergency Response Team within the period set by law, and persons whose data is affected shall be informed without undue delay.',
          'The security of the principal systems of the State shall be audited at least once every two years by independent auditors, whose summary findings shall be published.',
          'Systems shall be designed for resilience, with tested arrangements for backup and recovery that do not depend on a single location or provider.',
        ]),
      ),
      chapter(
        'Digital Government and Public Records',
        art('verifiable-records', 'Verifiable Public Records', [
          'The Acts of the Covenant Assembly, regulations, the decisions of the Cabinet, public appropriations, the Issuance Register, the Register of National Territory and other public registers designated by law shall be kept so that any person can verify that a published record has not been altered.',
          'Verification may use cryptographic methods, including digital signatures, hashing and distributed ledgers. A verification record proves the integrity of a published record; it does not by itself establish the truth of the facts recorded or confer any legal authority on the body that made it.',
          'Where a published record contains an error, it shall be corrected by a new published record that identifies the error and the correction. No record shall be silently altered or deleted.',
        ]),
        art('privacy-by-design', 'Data Minimisation and Privacy in Public Systems', [
          'Public digital systems shall collect only the personal data necessary for their purpose and shall be designed to protect privacy by default.',
          'Personal data of private persons shall not be published on any public register or ledger except as law expressly requires.',
          'Access to personal data in public systems shall be limited to authorised officials for defined purposes, logged and auditable. Every person may obtain a record of the public authorities that have accessed their data, save where law permits otherwise for the investigation of crime.',
        ]),
        art('e-signatures', 'Digital Signatures and Electronic Transactions', [
          'Law shall provide for the recognition of qualified electronic signatures and electronic documents, which shall have the same legal effect as their written equivalents, save for transactions that law requires to be made in another form.',
          'Electronic contracts are valid and enforceable in accordance with law.',
        ]),
        art('records-retention', 'Retention and Preservation of Records', [
          'Public records shall be retained and preserved in accordance with a published schedule established by law, and transferred to the national archives when no longer in current use.',
          'Records of permanent value shall be preserved in formats that remain accessible as technology changes.',
        ]),
        art('lawful-access', 'Lawful Investigative Access', [
          'Access by investigating authorities to data held in public or private systems is permitted only under law, for the investigation of crime or the protection of national security, and subject to judicial authorisation where it interferes with privacy.',
          'No law may require the provider of a communications or digital service to weaken the security of its systems for all users.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XVIII',
    title: 'Foreign Affairs, Treaties and International Cooperation',
    chapters: [
      chapter(
        'Foreign Relations',
        art('foreign-relations', 'Conduct of Foreign Relations', [
          'The conduct of foreign relations is the responsibility of the federation. The Chancellor represents the Sovereign Covenant State abroad, accredits and receives diplomatic representatives, and directs foreign policy with the Minister of Foreign Affairs and Justice.',
          'Aletheia shall conduct its foreign relations in accordance with the Charter of the United Nations and the principles of international law, including sovereign equality, the peaceful settlement of disputes and respect for the territorial integrity of States.',
          'The establishment of diplomatic and consular missions shall be authorised by law.',
        ]),
        art('recognition', 'Recognition and International Legal Personality', [
          'The Sovereign Covenant State shall seek recognition by other States and admission to international organisations by lawful, open and peaceful means.',
          'This Constitution does not by itself confer international legal personality, recognition or the capacity to enter into treaties. The State shall exercise those capacities only to the extent that it has acquired them under international law.',
        ]),
        art('treaties', 'Negotiation, Approval and Publication of Treaties', [
          'Treaties are negotiated and signed on behalf of the Sovereign Covenant State by the Chancellor or a person authorised by the Chancellor.',
          'A treaty that concerns the territory, the defence of the State, membership of an international organisation, the currency, public finances, the status or rights of persons, or that requires legislation for its implementation, may be ratified only after approval by an Act of the Covenant Assembly. A treaty that affects the powers of the constituent units also requires the consent of the Council of States.',
          'A treaty that transfers sovereign powers to an international organisation, or that alters the territory, requires approval by two-thirds of all members of the Covenant Assembly and, where it alters the territory, the consent of two-thirds of all members of the Council of States.',
          'Every treaty binding on Aletheia shall be published in the Official Gazette and, where international law so provides, registered with the Secretariat of the United Nations.',
          'A treaty that is inconsistent with this Constitution may not be ratified unless this Constitution is first amended. The High Court may be asked to determine the question before ratification under [[constitutional-review]].',
        ]),
        art('international-law', 'International Law in the Legal Order', [
          'The generally recognised rules of international law form part of the law of Aletheia.',
          'A treaty ratified and published in accordance with this Constitution forms part of the law of Aletheia and prevails over an inconsistent Act, save as this Constitution provides.',
          'Treaties on human rights binding on Aletheia shall be taken into account in interpreting the fundamental rights in Part V.',
        ]),
        art('commitments', 'Limits on Commitments that Bind Future Governments', [
          'No agreement, guarantee or undertaking that commits public funds or national territory beyond the current financial year, or that binds the State for more than five years, may be entered into by the executive without the approval of the Covenant Assembly, save as law expressly permits.',
          'A list of all international agreements and non-binding arrangements entered into by the executive shall be laid before the Covenant Assembly every six months.',
        ]),
        art('peaceful-settlement', 'Peaceful Settlement of Disputes', [
          'Aletheia renounces war as an instrument of policy and shall settle its international disputes by peaceful means.',
          'The State may accept the jurisdiction of international courts and tribunals by a declaration approved by the Covenant Assembly.',
          'The ADSS may be deployed outside the national territory only in self-defence, in accordance with a decision of an international organisation of which Aletheia is a member, or for search and rescue and humanitarian assistance, and in every case with the prior approval of the Covenant Assembly, save in an emergency requiring immediate action, in which case approval shall be sought within seven days.',
        ]),
        art('cooperation', 'International Cooperation', [
          'The State shall cooperate with other States and international organisations in maritime safety, environmental protection, the prevention of crime and the protection of human rights.',
          'Extradition and mutual legal assistance shall be provided in accordance with law and treaties binding on Aletheia. No person shall be extradited to face the death penalty or a real risk of torture, or for a political offence.',
          'The State shall comply with sanctions adopted by international organisations of which it is a member, in accordance with law.',
          'The Reserve Bank may cooperate with foreign central banks and international financial institutions within its functions under Part XII.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XIX',
    title: 'Independent Institutions and Public Integrity',
    chapters: [
      chapter(
        'Common Provisions',
        art('independent-common', 'Status of the Independent Institutions', [
          'The independent institutions are: the Auditor-General; the Electoral Commission; the Commissioner for Public Standards; the Ombudsman; the Information and Data Protection Commissioner; the Public Service Commission; the Procurement Review Board; and the National Statistician.',
          'The independent institutions are not ministries and are not attached to any ministry. They are subject only to this Constitution and the law, and shall not take instructions from any person in the performance of their functions.',
          'Unless this Part provides otherwise, the head of each independent institution, or each member of a collegiate institution, is appointed by the Covenant Assembly by three-fifths of all its members, on the proposal of a selection panel established by law after open competition, for a single term of seven years.',
          'The head or a member of an independent institution may be removed only for serious misconduct or permanent incapacity, on the finding of a tribunal of three judges, by a resolution of two-thirds of all members of the Covenant Assembly.',
          'The budget of each independent institution is laid before the Covenant Assembly with the Budget Bill, and shall be sufficient for the performance of its functions.',
          'Each independent institution shall report to the Covenant Assembly at least once a year and publish its reports. It is accountable for its expenditure to the Auditor-General, or, in the case of the Auditor-General, to independent auditors appointed by the committee on public accounts.',
          'The independent institutions shall cooperate and avoid duplication. Law may not establish a further independent institution except by amendment of this Constitution.',
        ]),
      ),
      chapter(
        'The Institutions',
        art('auditor-general', 'The Auditor-General', [
          'The Auditor-General audits the accounts and examines the economy, efficiency and effectiveness of every public authority, fund and state-owned undertaking, and certifies the matters that this Constitution requires.',
          'The Auditor-General has access to every record and person necessary for an audit, and decides independently what to audit and what to publish.',
        ]),
        art('electoral-commission', 'The Electoral Commission', [
          'The Electoral Commission organises and supervises elections and referendums, maintains the electoral register, reviews electoral districts and supervises campaign finance.',
          'The Electoral Commission consists of five members, of whom no more than two may have been members of the same political party in the preceding five years.',
          'The decisions of the Electoral Commission are subject to review by the High Court.',
        ]),
        art('public-standards', 'The Commissioner for Public Standards', [
          'The Commissioner for Public Standards keeps the registers of interests and declarations of assets of holders of public office, investigates breaches of the codes of conduct and of the rules on conflicts of interest and post-office employment, and may refer suspected offences to the Director of Public Prosecutions.',
          'The Commissioner has the investigative powers of an anti-corruption authority established by law, including the power to require the production of documents.',
        ]),
        art('ombudsman', 'The Ombudsman', [
          'The Ombudsman investigates complaints of maladministration and of violations of fundamental rights by public authorities, and may act on the Ombudsman’s own initiative.',
          'The Ombudsman may make recommendations, publish findings and bring proceedings before the courts in the public interest. The Ombudsman also exercises the functions of the national human-rights institution and, through the Police and Security Conduct Office, the oversight of the ADSS and the police under Part XVI.',
        ]),
        art('data-commissioner', 'The Information and Data Protection Commissioner', [
          'The Information and Data Protection Commissioner supervises the protection of personal data under [[data-rights]] and the right of access to public information under [[information]], hears complaints and may impose penalties established by law.',
        ]),
        art('public-service-commission', 'The Public Service Commission', [
          'The Public Service Commission ensures that appointments and promotions in the civil service are made on merit, sets standards of conduct for civil servants, and hears appeals in disciplinary matters.',
        ]),
        art('procurement-board', 'The Procurement Review Board', [
          'The Procurement Review Board hears complaints concerning the award of public contracts and concessions, may suspend a procedure and set aside an award, and publishes its decisions.',
        ]),
        art('statistician', 'The National Statistician', [
          'The National Statistician produces the official statistics of the State, including the census, in accordance with recognised professional standards, and determines independently their methods and the timing of their publication.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XX',
    title: 'Emergency Powers and National Resilience',
    chapters: [
      chapter(
        'States of Emergency',
        art('emergency', 'Declaration of a State of Emergency', [
          'A state of emergency may be declared only where the life of the nation, or the safety of the population of the national territory or a part of it, is threatened by armed attack, by a natural disaster, by the failure of critical infrastructure, by a cyber incident, by a public-health emergency or by serious public disorder, and the threat cannot be met by the ordinary powers of the authorities.',
          'The Chancellor declares a state of emergency by a published proclamation, which shall state its grounds, the area to which it applies, the measures authorised and its duration.',
          'The proclamation shall be laid before the Covenant Assembly immediately. It lapses unless approved by a majority of all members within seven days. If the Assembly cannot meet, it shall be convened at the earliest possible moment.',
          'A state of emergency may not exceed thirty days. It may be extended by the Covenant Assembly for periods of not more than thirty days, by three-fifths of all members, and, after ninety days, by two-thirds of all members.',
          'The Covenant Assembly may revoke the state of emergency at any time by a majority of the votes cast.',
        ]),
        art('emergency-limits', 'Limits on Emergency Powers', [
          'During a state of emergency, measures that limit fundamental rights are permitted only to the extent strictly required by the exigencies of the situation, only for the duration and in the area of the emergency, and without discrimination.',
          'The rights listed in Schedule 8 as non-derogable may not be limited or suspended.',
          'During a state of emergency: (a) this Constitution may not be amended; (b) the Covenant Assembly and the Council of States may not be dissolved and shall remain in session; (c) the courts continue to function and their jurisdiction may not be restricted; (d) no election may be postponed, save by an Act passed by two-thirds of all members of the Covenant Assembly, for a period not exceeding six months; and (e) the prohibition on monetary financing in [[no-monetary-finance]] remains in force.',
          'A person detained under emergency measures shall be brought before a judge within forty-eight hours, informed of the reasons for detention, and entitled to consult a lawyer. Detention without charge under emergency measures shall not exceed fourteen days.',
          'Emergency regulations lapse at the end of the state of emergency and may not create offences punishable by more than one year of imprisonment.',
        ]),
        art('emergency-review', 'Judicial Review and Accountability', [
          'The declaration of a state of emergency, its extension and every measure taken under it are subject to review by the High Court, which may set them aside if they do not satisfy this Part.',
          'All emergency measures, regulations and expenditure shall be published without delay.',
          'Within six months after a state of emergency ends, the Cabinet shall lay before the Covenant Assembly a report on its use of emergency powers, and the Assembly shall establish an independent review of the emergency.',
          'Every person who suffers loss through an unlawful emergency measure is entitled to compensation.',
        ]),
        art('resilience', 'National Resilience and Disaster Response', [
          'In a natural disaster or maritime emergency the authorities shall give priority to the protection of life, including evacuation in accordance with [[evacuation]].',
          'Emergency procurement during a state of emergency is permitted only for measures directly required by the emergency, shall be published within thirty days and shall be examined by the Auditor-General.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XXI',
    title: 'Constitutional Amendments and National Ratification',
    chapters: [
      chapter(
        'Amendment',
        art('amend-initiative', 'Proposal of Amendments', [
          'An amendment to this Constitution may be proposed by the Cabinet, by one-quarter of all members of the Covenant Assembly, by a majority of all members of the Council of States, or by citizens’ initiative supported by at least five per cent of registered voters.',
          'This Constitution may be amended only by an Act that expressly amends its text. No amendment may be made by implication.',
        ]),
        art('amend-ordinary', 'Ordinary Amendment Procedure', [
          'An amendment is adopted if it is passed by two-thirds of all members of the Covenant Assembly at a final vote held not earlier than ninety days after the first reading, and approved by two-thirds of all members of the Council of States.',
          'An amendment that alters the powers or boundaries of the constituent units, their representation, or Schedule 2 also requires the consent of the legislature of each constituent unit whose powers or boundaries are altered.',
          'If the Council of States does not approve the amendment within ninety days, it shall be submitted to a national referendum on the request of one-third of all members of the Covenant Assembly, and is adopted if approved by a majority of the votes cast and by a majority of voters in a majority of the constituent units.',
        ]),
        art('amend-entrenched', 'Entrenched Provisions', [
          'The provisions listed in Schedule 9 as entrenched may be amended only by the procedure in [[amend-ordinary(1)]] followed by approval in a national referendum by a majority of the votes cast and by a majority of voters in a majority of the constituent units.',
          'The following may not be amended in a manner that abolishes or destroys their essence: the inviolability of human dignity; the democratic, federal and constitutional character of the State; the separation of powers; the independence of the courts; and the prohibition on selling citizenship.',
          'The purpose of entrenchment is to protect the foundations of the national covenant from casual alteration, while permitting legitimate democratic reform by the people themselves.',
        ]),
        art('amend-review', 'Publication and Review of Amendments', [
          'An adopted amendment is promulgated by the Chancellor and published in the Official Gazette, together with a consolidated text of this Constitution, and enters into force on the date it specifies.',
          'The High Court may review an amendment only for compliance with the procedures of this Part and with [[amend-entrenched(2)]], on an application made within sixty days of publication.',
          'No amendment may be adopted during a state of emergency.',
        ]),
      ),
      chapter(
        'Ratification',
        art('ratification', 'Ratification of this Constitution', [
          'This Constitution shall be ratified by a referendum of the persons entitled to vote under Schedule 10, in which it is approved by a majority of the votes cast, with a turnout of at least half of those entitled to vote.',
          'The referendum shall be organised and supervised by an independent electoral body established in accordance with Schedule 10, whose report shall be published.',
          'Ratification alone does not bring this Constitution into force. It enters into force only when the conditions in [[effect]] are met.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XXII',
    title: 'Transitional, Founding and Implementation Provisions',
    chapters: [
      chapter(
        'The Founding Phase',
        art('founding-phase', 'The Founding Phase and the Status of Institutions', [
          'Until this Constitution enters into force, Aletheia is in its founding phase. During the founding phase no person or body exercises the public power of a State in the name of Aletheia.',
          'The institutions named in this Constitution are classified, for the purposes of public disclosure, as: (a) proposed constitutional institutions; (b) institutions operating as project or administrative structures of the founding community; (c) institutions requiring legal establishment; (d) institutions requiring physical territory or infrastructure; and (e) institutions requiring ratification, recognition, licensing or other external legal conditions. The founding administration shall publish, and keep current, the classification of each institution.',
          'No founding-phase body shall describe itself, or permit itself to be described, as exercising governmental, judicial, monetary or diplomatic authority.',
        ]),
        art('convention', 'The Constitutional Convention', [
          'Before this Constitution is submitted for ratification, it shall be settled by a Constitutional Convention of founding members, constituted and conducted in accordance with Schedule 10.',
          'The Convention shall publish every draft, every proposed amendment and its record of proceedings, and shall invite public comment for at least ninety days before adopting the final text.',
          'Founding members participate in the Convention in accordance with Schedule 10. Participation confers no citizenship and no public office.',
        ]),
        art('effect', 'Entry into Force', [
          'This Constitution enters into force on the date, fixed by the Constitutional Convention and published in the Official Gazette, on which all of the following conditions are met: (a) it has been ratified under [[ratification]]; (b) at least one platform has been established as national territory under [[establish-territory]] and is permanently inhabited; and (c) the Register of Citizens has been established in accordance with Schedule 10.',
          'The Auditor-General ad interim appointed under Schedule 10 shall certify publicly, with reasons, whether each condition in clause (1) has been met before the date of entry into force is fixed.',
          'Until this Constitution enters into force, it is a proposal without legal force.',
        ]),
        art('first-institutions', 'Establishment of the First Institutions', [
          'Within six months after this Constitution enters into force, elections shall be held for the Covenant Assembly, the Council of States and the office of Chancellor, in accordance with Schedule 10.',
          'The first Justices of the High Court shall be appointed within twelve months after entry into force, in accordance with [[justices-appointment]] and the transitional rules on staggered terms in Schedule 10.',
          'The Treasury, the Reserve Bank and the independent institutions shall be established within the periods set in Schedule 10.',
          'The Federal District of Antioch and the constituent states shall be established under [[establish-territory]] as platforms are built and incorporated.',
        ]),
        art('transfer', 'Transfer of Functions and Founding Documents', [
          'The functions performed by the founding administration shall pass to the constitutional institutions as each is established, in accordance with a published transition plan.',
          'Agreements, records and assets of the founding administration pass to the State only to the extent approved by an Act of the first Covenant Assembly, after audit by the Auditor-General.',
          'Draft statutes, design records and other documents published during the founding phase have no legal force unless enacted or adopted under this Constitution.',
        ]),
        art('amend-record', 'Record of Editions and Amendments', [
          'Every edition of this draft Constitution before entry into force, and every amendment after it, shall be published with its date, a summary of the changes and a verifiable record of its text, and the earlier texts shall remain available.',
        ]),
      ),
    ],
  },
  {
    numeral: 'XXIII',
    title: 'Final Provisions',
    chapters: [
      chapter(
        'Final Provisions',
        art('schedules', 'Schedules', [
          'The Schedules form part of this Constitution. Schedules 1 to 10 may be amended only in accordance with Part XXI, save where a Schedule expressly permits a matter to be regulated by law.',
        ]),
        art('authoritative-text', 'Authoritative Text', [
          'This Constitution is drawn up in English. Official translations into the other official languages shall be published by law; in the event of any difference, the English text prevails.',
        ]),
        art('citation', 'Citation', [
          'This Constitution may be cited as the Constitution of the Sovereign Covenant State of Aletheia or as the Covenant of Aletheia.',
        ]),
      ),
    ],
  },
];
