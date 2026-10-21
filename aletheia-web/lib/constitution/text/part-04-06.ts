import { art, chapter, type PartSource } from '../types';

export const PARTS_IV_VI: PartSource[] = [
  {
    numeral: 'IV',
    title: 'Citizenship, Nationality and Dual Citizenship',
    chapters: [
      chapter(
        'Acquisition of Citizenship',
        art('citizenship', 'Citizenship and its Foundations', [
          'Citizenship of Aletheia is a civic covenant between the citizen and the Sovereign Covenant State, carrying equal rights and equal duties for every citizen however acquired.',
          'Citizenship is acquired only by birth, by descent, by adoption or by naturalisation, as this Part provides.',
          'Citizenship shall never be sold, auctioned or conferred in return for investment, donation or any other payment. No law may provide for citizenship by investment.',
          'The detailed conditions and procedures for the acquisition and loss of citizenship shall be laid down by the Nationality and Citizenship Act, within the principles of this Part and Schedule 6.',
        ]),
        art('birth-descent', 'Citizenship at Birth and by Descent', [
          'A person born on or after the date on which this Constitution enters into force is a citizen of Aletheia at birth if, at the time of the birth, at least one parent is a citizen of Aletheia, wherever the birth takes place.',
          'A person born in the national territory who would otherwise be stateless is a citizen of Aletheia at birth.',
          'A child found in the national territory whose parents are unknown is presumed, until the contrary is proved, to have been born there to a citizen parent.',
          'Law may require the birth of a child born outside the national territory to be registered within a reasonable period, but failure to register shall not deprive a child of citizenship.',
        ]),
        art('adoption', 'Adoption', [
          'A child under eighteen years of age adopted by a citizen of Aletheia under an adoption recognised by the law of Aletheia acquires citizenship on the date the adoption takes effect.',
          'Law shall provide safeguards to ensure that adoption is not used to evade the requirements for naturalisation.',
        ]),
        art('naturalisation', 'Naturalisation', [
          'A person of full age may be granted citizenship by naturalisation if the person: (a) has resided lawfully and permanently in the national territory for at least five years; (b) has certified civic integration, including knowledge of this Constitution, the history and heritage of Aletheia and at least one official language; (c) is of good character as defined by law; and (d) takes the Covenant Oath set out in Schedule 5.',
          'Law may reduce the residence requirement for the spouse or registered partner of a citizen, for a person who has rendered exceptional service to the nation, and for a stateless person or refugee, but not below three years.',
          'Marriage to a citizen does not by itself confer citizenship.',
          'A minor child of a person being naturalised may be included in the grant, subject to law.',
          'Every application shall be decided on its merits, in writing, with reasons, within the period that law prescribes. A decision refusing citizenship is subject to administrative appeal and to judicial review under [[citizenship-appeal]].',
        ]),
        art('founding-citizens', 'Founding Citizens', [
          'The persons who become the first citizens of Aletheia when this Constitution enters into force shall be determined in accordance with Part XXII and Schedule 10.',
          'Membership of the founding community, or registration of interest in it, before this Constitution enters into force confers no citizenship and no right to citizenship.',
        ]),
      ),
      chapter(
        'Dual and Multiple Citizenship',
        art('dual', 'Dual and Multiple Citizenship', [
          'A citizen of Aletheia may hold the citizenship of one or more other States.',
          'A citizen of Aletheia does not lose citizenship by acquiring, or by already holding, the citizenship of another State.',
          'A person shall not be required to renounce another citizenship as a condition of naturalisation as a citizen of Aletheia.',
          'A child whose parents hold different nationalities may hold the citizenship of Aletheia together with every other citizenship to which the child is entitled.',
          'In the national territory a citizen of Aletheia who holds another citizenship has the same rights and duties as every other citizen, and shall be treated as a citizen of Aletheia.',
        ]),
        art('dual-duties', 'Dual Citizenship, Voting and Public Duties', [
          'A citizen may be registered to vote in the elections of Aletheia only once and in one electoral district.',
          'Dual citizenship does not by itself disqualify a citizen from public office. A holder of public office shall declare every other citizenship held, and the declaration shall be published.',
          'A citizen who holds the office of Chancellor, Minister, Justice of the High Court, Governor of the Reserve Bank, or the command of the Aletheian Defence & Security Service shall not, while in office, hold any public office, military commission or allegiance-bearing appointment in the service of another State.',
          'Law may require that holders of the offices listed in Schedule 4 as security-sensitive have held the citizenship of Aletheia for a minimum period before appointment. Such a requirement shall not distinguish between citizens by the manner in which citizenship was acquired, except by the length of time it has been held.',
          'Where the duties of a citizen to Aletheia conflict with duties owed to another State, the citizen shall declare the conflict, and law shall provide for its resolution in a manner that does not deprive the citizen of citizenship.',
        ]),
      ),
      chapter(
        'Loss of Citizenship and Safeguards',
        art('renunciation', 'Voluntary Renunciation', [
          'A citizen of full age may renounce the citizenship of Aletheia by a written declaration made under law.',
          'A renunciation does not take effect if the person would thereby become stateless.',
          'Renunciation during a state of emergency, or while the person is subject to criminal proceedings in Aletheia, takes effect only when the emergency or proceedings have ended, unless a court orders otherwise.',
        ]),
        art('deprivation', 'Deprivation of Citizenship', [
          'No citizen may be deprived of citizenship except as this Article provides. Citizenship shall never be withdrawn as a punishment for political opinion, religious belief, peaceful dissent or the exercise of any right guaranteed by this Constitution.',
          'Citizenship acquired by naturalisation may be revoked only where it was obtained by fraud, false representation or the concealment of a material fact attributable to the applicant, and only by order of a court, following proceedings in which the person has the right to be heard and represented.',
          'Revocation shall not be ordered if it would render the person stateless, save where the citizenship was obtained by fraud and international law permits; and in every case the court shall consider whether a less severe remedy, such as a penalty, is proportionate.',
          'Proceedings for revocation shall be commenced within ten years after the grant of citizenship.',
          'Citizenship acquired by birth or descent shall not be revoked.',
          'Loss of citizenship by one person shall not cause the loss of citizenship by that person’s spouse or children.',
        ]),
        art('statelessness', 'Prevention of Statelessness', [
          'The law of Aletheia shall be interpreted and applied so as to prevent statelessness.',
          'A person who has lost citizenship and would otherwise be stateless, other than by revocation for fraud, is entitled to have it restored on application.',
          'The State shall facilitate the naturalisation of stateless persons lawfully resident in the national territory.',
        ]),
        art('citizenship-appeal', 'Decisions, Appeals and Judicial Review', [
          'Every decision on the acquisition, renunciation, revocation or restoration of citizenship shall be made in writing, with reasons, and notified to the person concerned.',
          'A person affected by such a decision is entitled to an administrative review and to an appeal to the courts, which shall have full jurisdiction over the facts and the law.',
          'Where the decision rests on information withheld for reasons of security, the court shall have access to that information and law shall provide for a special advocate to represent the interests of the person concerned.',
        ]),
      ),
      chapter(
        'Citizenship Records and Consequences',
        art('citizenship-records', 'Citizenship Documents and Records', [
          'Every citizen is entitled to a certificate of citizenship and, once the State has the lawful authority to issue one, to a passport.',
          'The Register of Citizens is maintained by the Registrar General, an officer of the Ministry of Digital State and Registries appointed on merit by the Public Service Commission. It shall record only the personal data necessary to establish citizenship, and access to it is governed by [[data-rights]].',
          'A passport is the property of the State and evidence of citizenship; its refusal or withdrawal is subject to judicial review.',
        ]),
        art('citizenship-rights', 'Citizenship, Residence, Voting and Office', [
          'Citizenship confers the right to enter and reside in the national territory, the right to vote and stand in elections in accordance with Part VII, eligibility for public office subject to this Constitution, and the protection of the State abroad.',
          'Permanent residence is a distinct legal status governed by Part XV. It confers no right to vote in elections to the Covenant Assembly, but law may grant permanent residents the right to vote in local elections.',
          'The State shall provide consular assistance and diplomatic protection to its citizens abroad to the extent that its international position and the law of nations allow.',
        ]),
      ),
    ],
  },
  {
    numeral: 'V',
    title: 'Fundamental Rights, Liberties and Civic Duties',
    chapters: [
      chapter(
        'General Provisions',
        art('rights-scope', 'Scope and Holders of Fundamental Rights', [
          'The rights in this Part bind the legislature, the executive, the judiciary and every public authority, and shall be applied directly by the courts.',
          'The rights in this Part belong to every person within the jurisdiction of Aletheia, except where an Article expressly confers a right on citizens only.',
          'The following rights are reserved to citizens: the right to vote and stand in national elections, the right of unconditional entry into and residence in the national territory, and eligibility for the offices listed in Schedule 4 as reserved to citizens.',
          'The rights in this Part apply to legal persons to the extent that their nature permits.',
        ]),
        art('limits', 'Limitation of Fundamental Rights', [
          'A fundamental right may be limited only by or under an Act of the Covenant Assembly, and only if the limitation: (a) is clear and accessible; (b) pursues a legitimate aim recognised by this Constitution, such as the protection of public safety, public order, health, the rights and freedoms of others, or national security; (c) is suitable and necessary to achieve that aim; and (d) is proportionate, in that its burden on the right is not excessive in relation to the benefit it secures.',
          'An Act that limits a fundamental right shall apply generally and not to an individual case, and shall name the right that it limits.',
          'The essence of a fundamental right is inviolable.',
          'A limitation shall be applied without discrimination on any ground prohibited by [[equality]].',
          'Every limitation of a fundamental right is subject to review by the courts.',
          'The rights listed in Schedule 8 as non-derogable may not be limited or suspended at any time, including during a state of emergency.',
        ]),
      ),
      chapter(
        'Dignity, Equality and Personal Freedom',
        art('dignity', 'Human Dignity', [
          'Human dignity is inviolable. Every public authority shall respect and protect it.',
          'Every person has the right to life. The death penalty is abolished.',
        ]),
        art('equality', 'Equality Before the Law', [
          'All persons are equal before the law and are entitled to its equal protection.',
          'No person shall be discriminated against, directly or indirectly, on grounds of sex, race, colour, ethnic or social origin, language, religion or belief, political or other opinion, national origin, disability, age, birth or other status, save as this Constitution expressly provides.',
          'Measures adopted under law to remedy a demonstrated disadvantage are not discrimination if they are proportionate and temporary.',
          'Distinctions based on citizenship are permitted where this Constitution provides for them or where they are justified under [[limits]].',
        ]),
        art('torture', 'Prohibition of Torture and Cruel Treatment', [
          'No person shall be subjected to torture or to cruel, inhuman or degrading treatment or punishment.',
          'No person shall be held in slavery or servitude, or required to perform forced or compulsory labour, save as law permits in respect of lawful sentences, civil emergencies and normal civic obligations.',
          'Evidence obtained by torture or cruel treatment is inadmissible in any proceedings.',
        ]),
        art('liberty', 'Personal Liberty and Security', [
          'Every person has the right to liberty and security of person. No person shall be deprived of liberty except on grounds and in accordance with procedures established by law.',
          'A person who is arrested shall be told promptly, in a language the person understands, of the reasons for the arrest and of the person’s rights, including the right to remain silent and to consult a lawyer.',
          'A person arrested on suspicion of an offence shall be brought before a judge within forty-eight hours. A judge shall order release unless continued detention is lawful and necessary.',
          'Every person deprived of liberty has the right to have the lawfulness of the detention decided speedily by a court and to be released if it is unlawful.',
          'A person unlawfully detained is entitled to compensation.',
          'No person shall be detained in secret, and the place of detention of every person shall be notified without delay to a person of the detainee’s choosing.',
        ]),
        art('due-process', 'Due Process and Access to an Independent Court', [
          'Every person is entitled, in the determination of civil rights and obligations or of any criminal charge, to a fair and public hearing within a reasonable time by an independent and impartial court established by law.',
          'Judgments shall be pronounced publicly, save where law permits otherwise for the protection of minors, privacy or security, and in every case shall state their reasons.',
          'Every person has the right to an effective remedy before a court for the violation of any right guaranteed by this Constitution.',
          'The State shall provide legal aid, in accordance with law, to persons who lack sufficient means where the interests of justice require it.',
        ]),
        art('criminal-rights', 'Rights in Criminal Proceedings', [
          'Every person charged with a criminal offence is presumed innocent until proved guilty according to law.',
          'Every person charged with a criminal offence has the right: (a) to be informed promptly and in detail of the charge; (b) to adequate time and facilities to prepare a defence; (c) to defend oneself in person or through a lawyer of one’s choosing, or to be given legal assistance free of charge where the interests of justice require; (d) to examine witnesses and to obtain the attendance of witnesses on the same conditions as the prosecution; (e) to the free assistance of an interpreter; and (f) not to be compelled to testify against oneself.',
          'No person shall be held guilty of an offence on account of an act or omission that did not constitute an offence under law at the time it was committed, nor shall a heavier penalty be imposed than the one applicable at that time.',
          'No person shall be tried or punished again for an offence of which the person has been finally acquitted or convicted.',
          'Every person convicted of an offence has the right to have the conviction and sentence reviewed by a higher court.',
        ]),
        art('confiscation', 'Protection Against Arbitrary Confiscation', [
          'No property shall be confiscated as a penalty except by order of a court following a conviction, or in civil proceedings for the recovery of the proceeds of crime established by law in which the owner has the right to be heard.',
        ]),
      ),
      chapter(
        'Private Life, Conscience and Expression',
        art('privacy', 'Privacy, Home and Family Life', [
          'Every person has the right to respect for private and family life, home and correspondence.',
          'The home is inviolable. It may be searched only under a warrant issued by a judge, save in an emergency to prevent imminent danger to life, as defined by law.',
          'The confidentiality of correspondence and communications by any means is guaranteed. It may be interfered with only by order of a judge in accordance with [[surveillance]].',
        ]),
        art('data-rights', 'Data Protection and Digital Privacy', [
          'Every person has the right to the protection of personal data concerning them.',
          'Personal data shall be processed fairly, for specified purposes, on a lawful basis, and only to the extent necessary for those purposes.',
          'Every person has the right of access to personal data held about them by any public authority and the right to have it corrected.',
          'Compliance with this Article shall be supervised by the Information and Data Protection Commissioner under Part XIX.',
        ]),
        art('surveillance', 'Protection Against Unlawful Surveillance', [
          'General and indiscriminate surveillance of the population, and the general retention of communications data, are prohibited.',
          'Targeted surveillance is permitted only under a warrant issued by a judge of the High Court, for the investigation of a serious offence or the prevention of a grave threat to national security defined by law, and only for a limited period.',
          'A person who has been subject to surveillance shall be notified once notification no longer endangers its purpose, and is entitled to a remedy before the courts.',
          'Every use of surveillance powers shall be recorded and reported in aggregate each year to the Covenant Assembly.',
        ]),
        art('conscience', 'Freedom of Conscience and Religion', [
          'Freedom of thought, conscience and religion is guaranteed to every person.',
          'This freedom includes the freedom to hold, to change and to decline to hold any religion or belief, and the freedom to manifest one’s religion or belief, alone or in community with others, in public or in private, in worship, teaching, practice and observance.',
          'No person shall be compelled to join or leave a religious community, to take part in a religious act or to receive religious instruction, or be penalised for refusing to do so.',
          'The freedom to manifest a religion or belief may be limited only in accordance with [[limits]].',
          'The right to conscientious objection to bearing arms is guaranteed. Law shall provide an alternative civilian service of equal duration.',
        ]),
        art('expression', 'Freedom of Expression and of the Press', [
          'Every person has the right to freedom of expression, including the freedom to hold opinions and to seek, receive and impart information and ideas by any means, without interference by a public authority.',
          'The freedom of the press and of other media is guaranteed. Censorship is prohibited.',
          'The freedom of expression may be limited only in accordance with [[limits]], including for the protection of the reputation and rights of others, the prevention of incitement to violence or hatred, and the protection of information lawfully classified under law.',
          'Academic and artistic freedom are guaranteed.',
        ]),
        art('information', 'Access to Public Information', [
          'Every person has the right of access to information held by public authorities.',
          'Access may be refused only on grounds set by law that are necessary for the protection of personal data, national security, the prevention of crime, commercial confidentiality or the deliberations of government, and only for so long as the ground persists.',
          'A refusal of access may be appealed to the Information and Data Protection Commissioner and to the courts.',
        ]),
        art('peaceful-assembly', 'Freedom of Peaceful Assembly and of Association', [
          'Every person has the right to assemble peacefully and without arms. Law may require prior notice of assemblies in public places, but not prior permission.',
          'Every person has the right to form and join associations, including political parties and trade unions.',
          'An association may be prohibited or dissolved only by order of a court, on grounds set by law that satisfy [[limits]].',
          'Political parties shall respect the democratic order and this Constitution, and shall publish their accounts and the sources of their funding in accordance with [[campaign-finance]].',
        ]),
      ),
      chapter(
        'Economic, Social and Environmental Rights',
        art('property', 'Property and Expropriation', [
          'The right to own property, alone or in association with others, is guaranteed.',
          'No person shall be deprived of property except in the public interest, under law, and against fair compensation paid promptly.',
          'Compensation shall be determined in accordance with law and is subject to review by the courts.',
          'Law may regulate the use of property in the general interest, including for the protection of the environment and of the national heritage.',
        ]),
        art('commerce', 'Contractual Freedom and Lawful Commerce', [
          'Every person has the right to engage in lawful economic activity, to enter into contracts and to have them enforced by the courts.',
          'Law may regulate economic activity in the public interest and for the protection of consumers, workers, competition, public health and the environment.',
        ]),
        art('movement', 'Freedom of Movement', [
          'Every person lawfully within the national territory has the right to move freely within it and to leave it.',
          'Every citizen has the right to enter the national territory.',
          'The entry and residence of persons who are not citizens are governed by law under Part XV.',
          'Movement on and between platforms may be regulated by law for reasons of safety, security and the protection of private property.',
        ]),
        art('education-right', 'The Right to Education', [
          'Every person has the right to education. Primary and secondary education shall be compulsory and, in public schools, free of charge.',
          'Parents have the right to ensure the education and teaching of their children in conformity with their own religious and philosophical convictions, within the framework of Part VI.',
        ]),
        art('health-right', 'Health and Emergency Medical Assistance', [
          'Every person has the right of access to preventive health care and to medical treatment under the conditions established by law.',
          'No person in the national territory shall be refused emergency medical assistance.',
        ]),
        art('labour', 'Labour Rights and Workplace Safety', [
          'Every worker has the right to fair and just working conditions, to safe and healthy workplaces, to reasonable limitation of working hours and to paid annual leave.',
          'Workers and employers have the right to organise and to bargain collectively. The right to strike is guaranteed in accordance with law, which may limit it in essential services.',
          'The employment of children below the minimum age set by law is prohibited.',
        ]),
        art('family-right', 'Marriage, Family and Parental Responsibility', [
          'The family is the natural and fundamental unit of society and is entitled to the protection of the State.',
          'Marriage shall be entered into only with the free and full consent of the intending spouses. The forms and legal effects of marriage are governed by law.',
          'Parents have the primary right and duty to care for and bring up their children.',
        ]),
        art('children', 'Protection of Children', [
          'In all actions concerning children, the best interests of the child shall be a primary consideration.',
          'Every child has the right to protection from neglect, abuse, exploitation and violence, and to the care necessary for the child’s well-being.',
          'A child may be separated from the child’s parents against their will only by order of a court, where necessary for the child’s best interests.',
        ]),
        art('disability', 'Persons with Disabilities', [
          'Persons with disabilities have the right to participate fully in the life of the community, and to reasonable accommodation in public services, education, employment and access to buildings and platforms.',
          'New public buildings, platforms and digital public services shall be designed to be accessible.',
        ]),
        art('environment-right', 'Environmental Rights and Duties', [
          'Every person has the right to a healthy environment and the duty to protect it.',
          'The State shall protect the sea, the air and living resources for present and future generations, and shall ensure that the use of natural resources is sustainable.',
        ]),
        art('minorities', 'Protection of Minorities', [
          'Persons belonging to national, ethnic, religious or linguistic minorities have the right, in community with the other members of their group, to enjoy their own culture, to profess and practise their own religion and to use their own language, in accordance with law and subject to the rights of others.',
        ]),
        art('non-citizens', 'Rights of Lawful Residents and Non-Citizens', [
          'Persons who are not citizens enjoy the rights in this Part, save those reserved to citizens by [[rights-scope(3)]].',
          'A person lawfully resident in the national territory may be removed from it only under a decision reached in accordance with law, against which the person has the right of appeal under Part XV.',
        ]),
      ),
      chapter(
        'Civic Duties',
        art('duties', 'Civic Duties', [
          'Every person in the national territory shall respect this Constitution, the law and the rights and freedoms of others.',
          'Every citizen shall, in accordance with law: (a) contribute to the common good; (b) serve on a jury when lawfully summoned; (c) render assistance in a public emergency; and (d) take part in the defence and civil protection of the nation, by military or civilian service, as law provides.',
          'Duties under this Article shall be imposed only by law and shall not be enforced so as to limit any right except in accordance with [[limits]].',
        ]),
      ),
    ],
  },
  {
    numeral: 'VI',
    title: 'Family, Education, Culture and Social Institutions',
    chapters: [
      chapter(
        'Family and Social Institutions',
        art('family-policy', 'The Family and Child Welfare', [
          'The State shall support families in the care and upbringing of children, through law, public services and the tax and benefit system.',
          'The State shall provide for the care of children who are deprived of a family environment, giving priority to placement within a family.',
        ]),
        art('social-care', 'Public Health and Social Care', [
          'The State shall maintain a system of public health and social care that is universal in coverage, financed under Part XIII and delivered by public, charitable and private providers under law.',
          'Health outcomes, waiting times and the use of public health funds shall be published.',
          'Patient records belong to the patient, who shall control access to them in accordance with [[data-rights]].',
        ]),
        art('charities', 'Charitable Organisations and Community Service', [
          'The State recognises the contribution of charitable organisations, including Christian charitable foundations, to the common good, and may support them under law.',
          'Charitable organisations shall be registered, shall publish their accounts and shall be supervised by an authority established by law.',
          'Law may encourage voluntary community service by young people and others.',
        ]),
        art('safeguarding', 'Safeguards Against Abuse in Institutions', [
          'Every school, care home, hospital, religious organisation, youth organisation and other institution that has the care of children or vulnerable adults shall maintain safeguarding arrangements meeting standards set by law, and shall be subject to independent inspection.',
          'A person who works with children or vulnerable adults shall be subject to background checks under law.',
          'Every allegation of abuse in an institution shall be reported to the competent authorities. No institution may investigate such an allegation solely by itself.',
        ]),
      ),
      chapter(
        'Education and Research',
        art('education-system', 'Education and the National Curriculum', [
          'The State shall ensure a system of education that develops the full personality of every child, respect for human dignity and the knowledge and skills required for life and work.',
          'The national curriculum shall be established by law and shall include civic and constitutional education, and the history of Aletheia, its Christian heritage, its maritime identity and its founding principles.',
          'Teaching about the Christian heritage of the nation in public schools is part of the national curriculum. Religious instruction in the faith of any church is voluntary, and no pupil shall be required to attend it against the wishes of the pupil’s parents or, at an age set by law, of the pupil.',
        ]),
        art('schools', 'Public, Private and Christian Schools', [
          'The State shall maintain public schools open to all children.',
          'Every person and association, including churches and religious organisations, has the right to establish and run private schools, including Christian schools, which meet the standards set by law and are subject to inspection.',
          'Law may provide public funding for private schools on equal and objective criteria.',
        ]),
        art('higher-education', 'Higher Education, Vocational Training and Research', [
          'The State shall promote higher education, vocational training and lifelong learning, with particular attention to engineering, maritime science, medicine and the skills on which the nation depends.',
          'Universities are self-governing within the law. Academic freedom in teaching and research is guaranteed.',
          'Research funded by the State shall be awarded on merit, and its results published, save where law protects security or commercial confidentiality.',
        ]),
      ),
      chapter(
        'Culture, Language and Heritage',
        art('culture', 'Culture, Archives and Heritage', [
          'The State shall establish and maintain a national library, national archives and other cultural institutions, and shall protect the cultural heritage of the nation.',
          'The national archives shall preserve the records of the constitutional institutions permanently.',
          'The State shall promote the official languages and support the preservation of the languages spoken by its citizens.',
        ]),
        art('youth', 'Youth and Civic Participation', [
          'The State shall promote the participation of young people in civic, social and cultural life.',
          'Law may establish a national youth council to advise the constitutional institutions.',
        ]),
      ),
    ],
  },
];
