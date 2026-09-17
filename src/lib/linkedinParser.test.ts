import { describe, it, expect } from 'vitest';
import { profileFromTokens, type Token } from './linkedinParser';

// Tokens laid out like a LinkedIn export (measured on a real one): body text at
// 10.5 pt with an 18 pt line step, a blank line between paragraphs (36 pt),
// the sidebar at x=22 and the main column at x=224.

const t = (page: number, fontSize: number, x: number, y: number, text: string): Token => ({ page, fontSize, x, y, text });
const body = (page: number, y: number, text: string) => t(page, 10.5, 224, y, text);

const HEADER: Token[] = [
  t(1, 13, 22, 738, 'Coordonnées'),
  t(1, 10.5, 22, 718, '0611223344'),
  t(1, 10.5, 83, 718, '(Mobile)'),
  t(1, 10.5, 22, 706, 'jane@example.com'),
  t(1, 11, 22, 681, 'www.linkedin.com/in/jane-doe'),
  t(1, 11, 22, 667, '(LinkedIn)'),
  t(1, 13, 22, 632, 'Principales compétences'),
  t(1, 10.5, 22, 612, 'Réglementation des données de'),
  t(1, 10.5, 22, 599, 'l’UE pour l’IA locale (Data Act)'),
  t(1, 10.5, 22, 582, "Gouvernance de l'IA"),
  t(1, 10.5, 22, 564, 'Recherche utilisateur'),
  t(1, 13, 22, 530, 'Languages'),
  t(1, 10.5, 22, 462, 'Anglais'),
  t(1, 10.5, 59, 462, '(Full Professional)'),
  t(1, 26, 224, 726, 'Jane Doe'),
  t(1, 12, 224, 705, 'Head of Product Design | Business, Tech'),
  t(1, 12, 224, 691, '& Design | Founder Studio'),
  t(1, 12, 224, 661, 'Paris et périphérie'),
];

const SUMMARY_LINES = [
  'Mon métier tient en une phrase : je fais tenir ensemble le',
  'business, la technique et le design sur des produits où les trois',
  "se contredisent. Chaque étape m'a appris à parler à la table d'à côté.J'ai",
  'livré pour des marques exigeantes en Node.JS, avec une approche user-',
  'centered et +25% de conversion sur le paywall',
  'et -40% de temps de recrutement interne, sur des équipes de 20 personnes.',
];

const SUMMARY: Token[] = [
  t(1, 15.75, 224, 623, 'Résumé'),
  ...SUMMARY_LINES.map((text, i) => t(1, 12, 224, 598 - i * 18, text)),
];

const EXPERIENCE: Token[] = [
  t(2, 15.75, 224, 580, 'Expérience'),
  t(2, 12, 224, 544, 'Acme Group'),
  t(2, 11.5, 224, 528, 'Lead AI Product & Design'),
  body(2, 514, 'janvier 2026 - Present'),
  t(2, 10.5, 329, 514, '(8 mois)'),
  body(2, 499, 'Boulogne-Billancourt, Île-de-France, France'),
  body(2, 478, "Chez Acme, je conduis une équipe pluridisciplinaire à travers une phase"),
  body(2, 460, "d'évolution Design et IA."),
  body(2, 424, 'Aujourd’hui je porte trois choses en parallèle :'),
  body(2, 406, "- La direction d'équipe, en alignant disciplines et cultures sur des objectifs"),
  body(2, 388, 'partagés.'),
  body(2, 370, '- La roadmap intégrée Tech, Design et stratégie groupe, avec les arbitrages'),
  body(2, 352, 'réguliers (et la diplomatie qui va avec).'),
  body(2, 334, '- Design Systems et UX : architecture scalable, méthodologies user-'),
  body(2, 316, 'centered.'),
  body(2, 280, 'Gouvernance des usages IA : cadrage de ce qui est autorisé, sur quelles'),
  body(2, 262, 'données, avec quel niveau de validation avant mise en production.'),
  body(2, 226, '- Réduit le temps de recrutement de'),
  body(2, 208, '-40% sur deux ans'),
  body(2, 190, '- Anime le comite design sans point final'),
  body(2, 46, "- Classification des cas d'usage par niveau de risque au sens AI Act."),
  t(2, 9, 381, 14, 'Page'),
  body(3, 737, '- Contribution au cadre de documentation et de traçabilité des systèmes'),
  body(3, 719, 'IA, repris par 4 équipes.'),
  t(3, 12, 224, 627, 'Studio'),
  t(3, 11.5, 224, 611, 'Founder · Product, Design & AI Studio'),
  body(3, 596, 'septembre 2016 - Present'),
  body(3, 581, 'Paris (France)'),
  body(3, 560, 'Studio est mon atelier Product, Design et IA. Il marche sur trois jambes :'),
  body(3, 542, 'agence, formation et lab.'),
  body(3, 506, 'Concrètement, je porte des projets transverses pour des équipes de 20'),
  body(3, 488, 'personnes et plus, un portfolio de 8 à 12 missions simultanées.'),
  t(4, 12, 224, 737, 'Bureau Conseil'),
  t(4, 11.5, 224, 721, 'Consultant'),
  body(4, 707, 'mars 2010 - avril 2012'),
  body(4, 686, 'Missions principales :'),
  body(4, 668, '- Audit des parcours clients'),
  body(4, 300, '- Refonte des outils internes sans point final'),
  body(5, 737, 'Un paragraphe de prose en haut de page.'),
];

const tokens = [...HEADER, ...SUMMARY, ...EXPERIENCE];

describe('profileFromTokens', () => {
  const cv = profileFromTokens(tokens)!;
  const [acme, studio, conseil] = cv.experience;

  it('reads a LinkedIn export', () => {
    expect(cv).not.toBeNull();
    expect(cv.personal_info.name).toBe('Jane Doe');
    expect(cv.experience).toHaveLength(3);
  });

  it('keeps a bullet whole when it wraps onto the next line', () => {
    expect(acme.description).toContain("La direction d'équipe, en alignant disciplines et cultures sur des objectifs partagés.");
    expect(acme.description).toContain('La roadmap intégrée Tech, Design et stratégie groupe, avec les arbitrages réguliers (et la diplomatie qui va avec).');
  });

  it('joins a word cut at the end of a line', () => {
    expect(acme.description).toContain('Design Systems et UX : architecture scalable, méthodologies user-centered.');
  });

  // "-40%" opening a wrapped line is a number, not a bullet
  it('reads a wrapped line opening with a minus sign as the rest of the bullet', () => {
    expect(acme.description).toContain('Réduit le temps de recrutement de -40% sur deux ans');
  });

  it('never reads a lead-in as the intro', () => {
    expect(conseil.intro).toBeUndefined();
    expect(conseil.description[0]).toBe('Audit des parcours clients');
  });

  it('starts a new entry at the top of a page when the line above did not reach its bottom', () => {
    expect(conseil.description.slice(1)).toEqual(['Refonte des outils internes sans point final', 'Un paragraphe de prose en haut de page.']);
  });

  it('keeps a bullet whole across a page break', () => {
    expect(acme.description).toContain("Classification des cas d'usage par niveau de risque au sens AI Act.");
    expect(acme.description).toContain('Contribution au cadre de documentation et de traçabilité des systèmes IA, repris par 4 équipes.');
  });

  it('keeps every paragraph: the first is the intro, the others are bullets', () => {
    expect(acme.intro).toBe("Chez Acme, je conduis une équipe pluridisciplinaire à travers une phase d'évolution Design et IA.");
    expect(acme.description).toContain('Gouvernance des usages IA : cadrage de ce qui est autorisé, sur quelles données, avec quel niveau de validation avant mise en production.');
    expect(studio.intro).toBe('Studio est mon atelier Product, Design et IA. Il marche sur trois jambes : agence, formation et lab.');
    // The numbers of a prose paragraph are what the truth guard later backs a KPI with
    expect(studio.description).toEqual(['Concrètement, je porte des projets transverses pour des équipes de 20 personnes et plus, un portfolio de 8 à 12 missions simultanées.']);
  });

  it('drops a lead-in that only introduces the list below it', () => {
    expect(acme.description.some(d => d.endsWith(':'))).toBe(false);
    expect(acme.description).toHaveLength(8);
  });

  it('reads dates and places before the text', () => {
    expect(acme).toMatchObject({ start_date: 'Janvier 2026', current: true, location: 'Boulogne-Billancourt, Île-de-France, France' });
    expect(studio).toMatchObject({ company: 'Studio', location: 'Paris (France)' });
  });

  it('keeps the whole summary, sentences apart', () => {
    const summary = cv.personal_info.summary ?? '';
    expect(summary).toContain("à la table d'à côté. J'ai livré");
    expect(summary).toContain('en Node.JS, avec une approche user-centered et');
    expect(summary.endsWith('sur des équipes de 20 personnes.')).toBe(true);
  });

  it('reads a skill that wraps as one skill', () => {
    const items = cv.skills.flatMap(cat => cat.items);
    expect(items).toContain('Réglementation des données de l’UE pour l’IA locale (Data Act)');
    expect(items).toHaveLength(3);
  });

  it('reads the last short line of the headline as the location, not the title', () => {
    expect(cv.personal_info.location).toBe('Paris et périphérie');
    expect(cv.personal_info.title).toBe('Head of Product Design | Business, Tech & Design | Founder Studio');
  });

  it('reads a lone "City, Region, Country" line as the location, and trims a long title', () => {
    const header = (lines: string[]) => [
      ...HEADER.filter(tok => tok.fontSize !== 12),
      ...lines.map((text, i) => t(1, 12, 224, 705 - i * 14, text)),
      ...SUMMARY, ...EXPERIENCE,
    ];
    expect(profileFromTokens(header(['Lyon, Auvergne-Rhône-Alpes, France']))!.personal_info).toMatchObject({ location: 'Lyon, Auvergne-Rhône-Alpes, France', title: '' });
    const long = profileFromTokens(header(['Head of Design | Product | Research | Design Systems | Design Operations | Strategy', 'and Organisational Transformation', 'Nantes']))!;
    expect(long.personal_info).toMatchObject({ title: 'Head of Design | Product | Research', location: 'Nantes' });
  });

  it('answers null for a PDF that is not a LinkedIn export', () => {
    expect(profileFromTokens(tokens.filter(tok => !tok.text.includes('linkedin.com')))).toBeNull();
  });
});
