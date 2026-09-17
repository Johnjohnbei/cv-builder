/**
 * A CV that does NOT fit on two pages at full detail: 6 roles, 5 bullets each.
 * No displayMode anywhere on purpose — that is what a fresh import or an AI
 * generation looks like, and it is the only state the fit pass runs on.
 */

const BULLETS = [
  'Construit un design system Figma partage entre 5 equipes produit, adopte a 90% en 6 mois',
  'Conduit 60+ entretiens utilisateurs et 12 tests d utilisabilite pour cadrer la roadmap SaaS',
  'Reduit le taux d abandon du tunnel de 34% via une refonte des formulaires d onboarding',
  'Mis en place le rituel de design review hebdomadaire avec les Product Managers et les devs',
  'Defini et suivi les KPIs produit (conversion, NPS, retention) avec l equipe data',
];

const ROLES: [string, string, string, string | undefined, boolean, string][] = [
  ['Head of Product Design', 'TF1', '2022-01', undefined, true, 'Direction de la fonction design sur les produits streaming grand public.'],
  ['Lead Product Designer', 'Marmiton', '2019-03', '2021-12', false, 'Refonte du parcours recettes et du design system multi-plateformes.'],
  ['Product Designer', 'Chateauform', '2017-01', '2019-02', false, 'Conception des outils de reservation et du back-office commercial.'],
  ['Senior UX Designer', 'Sprize', '2014-06', '2016-12', false, 'Design de l app mobile de fidelite et des parcours de paiement.'],
  ['UX Designer', 'Dixner', '2012-01', '2014-05', false, 'Interfaces B2B pour la logistique et le suivi de flotte.'],
  ['Designer graphique', 'Agence Studio', '2009-09', '2011-12', false, 'Identite visuelle et supports print pour des clients retail.'],
];

export const LONG_CV = {
  personal_info: {
    name: 'Marie Dupont',
    email: 'marie.dupont@example.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris, France',
    title: 'Product Design Leader',
    summary: "Product Design Leader avec 15 ans d experience en design system, recherche utilisateur et management d equipes design sur des produits SaaS B2B et grand public.",
    linkedin: 'linkedin.com/in/marie-dupont',
  },
  experience: ROLES.map(([position, company, start_date, end_date, current, intro]) => ({
    company, position, start_date, end_date, current, intro,
    description: [...BULLETS],
    kpi: 'NPS produit passe de 32 a 67 en 18 mois',
  })),
  education: [
    { school: 'Ecole de Design de Paris', degree: 'Master Design Interaction', field: 'UX/UI', start_date: '2007', end_date: '2009' },
    { school: 'Universite Paris 8', degree: 'Licence Arts Plastiques', start_date: '2004', end_date: '2007' },
  ],
  skills: [
    { category: 'Outils Design', items: ['Figma', 'Sketch', 'Adobe XD', 'Principle', 'Framer'] },
    { category: 'Methodes', items: ['Design Thinking', 'Jobs-to-be-Done', 'Tests utilisateurs', 'Design Sprint'] },
    { category: 'Technique', items: ['HTML/CSS', 'React', 'Storybook', 'Zeroheight'] },
  ],
  languages: [
    { name: 'Francais', proficiency: 'Natif' },
    { name: 'Anglais', proficiency: 'Courant (C1)' },
  ],
};

/**
 * A career of 20 roles with the layout of a real LinkedIn import (measured
 * 2026-09-17): its dates, which roles are held today, and the length of every
 * intro, bullet and KPI, the words replaced. Two pages hold a few roles only.
 * [current, start, end, intro length, bullet lengths, KPI length, matches the offer]
 */
const CAREER: [boolean, string, string, number, number[], number, boolean][] = [
  [true, 'Janvier 2026', '', 149, [121, 102, 129, 120], 0, false],
  [true, 'Septembre 2016', '', 171, [105, 114, 108, 137], 0, true],
  [true, 'Juillet 2018', '', 138, [120, 119, 112], 26, false],
  [false, 'Janvier 2025', 'Décembre 2025', 181, [162, 144, 126, 141], 0, true],
  [false, 'Décembre 2024', 'Avril 2025', 155, [116, 110, 105, 117], 0, false],
  [false, 'Octobre 2024', 'Mars 2025', 151, [101, 89, 106, 152], 26, true],
  [false, 'Décembre 2023', 'Juin 2024', 105, [123, 111, 96], 0, true],
  [false, 'Janvier 2022', 'Septembre 2023', 188, [138, 111, 120, 120, 190], 34, true],
  [false, 'Janvier 2021', 'Juillet 2021', 132, [121, 104, 116, 93], 25, true],
  [false, 'Juillet 2019', 'Décembre 2020', 133, [240, 228, 116, 166], 42, true],
  [false, 'Octobre 2018', 'Juin 2020', 109, [114, 125, 71], 0, false],
  [false, 'Janvier 2019', 'Décembre 2019', 157, [159, 123, 133, 115], 0, false],
  [false, 'Janvier 2019', 'Juillet 2019', 126, [140, 133, 112, 155], 32, false],
  [false, 'Septembre 2014', 'Janvier 2019', 142, [177, 160, 160, 109], 0, false],
  [false, 'Juillet 2018', 'Décembre 2018', 181, [96, 161, 95, 171], 34, false],
  [false, 'Janvier 2018', 'Juillet 2018', 169, [129, 120, 110], 20, false],
  [false, 'Janvier 2014', 'Juin 2016', 122, [122, 163, 172, 169], 0, false],
  [false, 'Février 2013', 'Février 2014', 122, [97, 105, 176], 0, false],
  [false, 'Janvier 2015', 'Janvier 2015', 248, [], 0, false],
  [false, 'Février 2012', 'Février 2013', 132, [112, 73, 126, 106], 0, false],
];

const FILLER = 'Organise les ateliers clients et le suivi des fournisseurs avec les equipes achats et la direction generale ';
const text = (length: number, start = '') => (start + FILLER.repeat(Math.ceil(length / FILLER.length))).slice(0, length).trim();

export const VERY_LONG_CV = {
  ...LONG_CV,
  experience: CAREER.map(([current, start_date, end_date, intro, bullets, kpi, matches], i) => ({
    company: `Entreprise ${i + 1}`,
    position: matches ? 'Lead Product Designer' : 'Responsable des operations',
    start_date, end_date, current,
    intro: text(intro),
    // A role matching the offer says so in its first bullet
    description: bullets.map((length, b) => text(length, matches && b === 0 ? 'Construit le design system Figma et ' : '')),
    kpi: text(kpi),
  })),
};

export const LONG_CV_JOB_DESCRIPTION = `Nous recherchons un Product Design Leader pour piloter la fonction design de notre plateforme SaaS B2B.
Missions : construire et maintenir le design system sous Figma et Storybook, conduire les recherches utilisateurs,
definir et suivre les KPIs produit (conversion, NPS, retention), manager une equipe de designers.
Profil : 8+ ans en Product Design sur du SaaS, maitrise de Figma, experience des design systems a grande echelle, culture data, Agile.`;
