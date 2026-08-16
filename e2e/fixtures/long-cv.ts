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

export const LONG_CV_JOB_DESCRIPTION = `Nous recherchons un Product Design Leader pour piloter la fonction design de notre plateforme SaaS B2B.
Missions : construire et maintenir le design system sous Figma et Storybook, conduire les recherches utilisateurs,
definir et suivre les KPIs produit (conversion, NPS, retention), manager une equipe de designers.
Profil : 8+ ans en Product Design sur du SaaS, maitrise de Figma, experience des design systems a grande echelle, culture data, Agile.`;
