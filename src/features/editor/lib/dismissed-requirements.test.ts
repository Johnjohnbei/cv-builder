import { describe, it, expect } from 'vitest';
import type { CVData, JobRequirement, RequirementKind } from '@/src/shared/types';
import { dismissedIdsOf, dismissedOf, withDismissed, withRestored, withoutDismissed } from './dismissed-requirements';

const requirement = (id: string, label: string, variants: string[] = [], kind: RequirementKind = 'tool'): JobRequirement =>
  ({ id, label, variants, kind, importance: 'required', quote: label });
const NODE = requirement('node-js', 'Node.js');
const FIGMA = requirement('figma', 'Figma');

const SUMMARY = 'Product designer en SaaS B2B. Expert Node.js et React. Six ans de parcours.';
const ACME = { intro: 'Équipe paiement, Node.js.', description: ['Conçu les maquettes Figma', 'Développé en Node.js'] };
const BETA = { description: ['Déployé Node.js'] };

/** A generated CV showing its adapted texts, the imported ones beside them */
const CV: CVData = {
  personal_info: {
    name: 'Alex', email: 'a@b.c', summary: SUMMARY,
    versions: { summary: { adapted: SUMMARY, original: 'Designer produit en SaaS B2B. Six ans de parcours.' } },
  },
  experience: [
    {
      company: 'Acme', position: 'Designer', start_date: '2020', current: true, ...ACME,
      versions: { adapted: ACME, original: { intro: 'Équipe paiement.', description: ['Conçu les maquettes'] } },
    },
    { company: 'Beta', position: 'UI', start_date: '2018', current: false, ...BETA, versions: { adapted: BETA, original: { description: ['Dessiné les écrans'] } } },
  ],
  education: [], languages: [],
  skills: [{ category: 'tools', items: ['Figma', 'Node.js'] }, { category: 'other', items: ['Node.js'] }],
};

const dismissing = (cv: CVData, ...requirements: JobRequirement[]) =>
  requirements.reduce((next, r) => withDismissed(next, r), cv);

describe('withoutDismissed: the CV as it prints', () => {
  it('prints the CV untouched while nothing is dismissed', () => {
    expect(withoutDismissed(CV)).toBe(CV);
  });

  // Kept whole on the CV: no analysis of the offer, no cache, another device
  it('leaves out every text writing a dismissed requirement, and only those, from the CV alone', () => {
    const printed = withoutDismissed(dismissing(CV, NODE));
    expect(printed.experience[0].description).toEqual(['Conçu les maquettes Figma']);
    expect(printed.skills).toEqual([{ category: 'tools', items: ['Figma'] }]);
  });

  it('keeps what is left of the summary, and takes the imported intro or bullets where it empties them', () => {
    const printed = withoutDismissed(dismissing(CV, NODE));
    expect(printed.personal_info.summary).toBe('Product designer en SaaS B2B. Six ans de parcours.');
    expect(printed.experience[0].intro).toBe('Équipe paiement.');
    // Every bullet wrote it: the imported ones print instead
    expect(printed.experience[1].description).toEqual(['Dessiné les écrans']);
  });

  // A typo fixed in a block does not change what prints for the whole block
  it('treats a text the user typed like any other: what is left stays, an emptied one takes the imported', () => {
    const typed: CVData = {
      ...CV,
      personal_info: { ...CV.personal_info, summary: 'Mon résumé. Je connais Node.js. Fin.' },
      experience: [{ ...CV.experience[0], description: ['Ma puce Node.js'] }, CV.experience[1]],
    };
    const printed = withoutDismissed(dismissing(typed, NODE));
    expect(printed.personal_info.summary).toBe('Mon résumé. Fin.');
    expect(printed.experience[0].description).toEqual(['Conçu les maquettes']);
  });

  it('empties a KPI writing it, and keeps the facts of the CV', () => {
    const cv: CVData = { ...CV, experience: [{ ...CV.experience[0], kpi: 'Migré 12 services vers Node.js', position: 'Développeur Node.js' }] };
    const [exp] = withoutDismissed(dismissing(cv, NODE)).experience;
    expect(exp.kpi).toBe('');
    expect(exp.position).toBe('Développeur Node.js');
  });

  // A degree, a language, years or a title are the user's own facts: dismissing one sets the gap aside
  it('takes nothing out for a dismissed title, degree or language', () => {
    const cv: CVData = { ...CV, personal_info: { ...CV.personal_info, summary: 'Je vise un poste de Lead Designer. Titulaire d\'un Master.' } };
    const printed = withoutDismissed(dismissing(cv, requirement('lead-designer', 'Lead Designer', [], 'title'), requirement('master', 'Master', [], 'education')));
    expect(printed.personal_info.summary).toBe(cv.personal_info.summary);
  });

  it('knows a requirement by its variants, in the other language too', () => {
    const research = requirement('user-research', 'user research', ['recherche utilisateur'], 'method');
    const cv: CVData = { ...CV, experience: [{ ...CV.experience[0], description: ['Mené la recherche utilisateur', 'Livré'] }] };
    expect(withoutDismissed(dismissing(cv, research)).experience[0].description).toEqual(['Livré']);
  });

  it('keeps the CV\'s own texts: "Remettre" prints them again', () => {
    const dismissed = dismissing(CV, NODE);
    expect(dismissed.experience).toBe(CV.experience);
    const restored = withRestored(dismissed, NODE.id);
    expect(dismissedIdsOf(restored)).toEqual([]);
    expect(withoutDismissed(restored)).toBe(restored);
  });

  it('keeps one entry per requirement, only what finds it in a text', () => {
    const cv = dismissing(CV, FIGMA, FIGMA);
    expect(cv.dismissedRequirements).toEqual([{ id: 'figma', label: 'Figma', variants: [], kind: 'tool' }]);
  });

  // A build that never shipped kept bare ids: read as nothing, never as a crash
  it('skips a dismissal stored in another shape', () => {
    const stale = { ...CV, dismissedRequirements: ['figma'] } as unknown as CVData;
    expect(dismissedOf(stale)).toEqual([]);
    expect(withoutDismissed(stale)).toBe(stale);
  });

  // Convex declares four fields of strings: an entry it would refuse never reaches a save
  it('reads only entries Convex accepts, with their four fields', () => {
    const mixed = {
      ...CV,
      dismissedRequirements: [
        { id: 'figma', label: 'Figma', variants: [null], kind: 'tool' },
        { id: 'node-js', label: 'Node.js', variants: [], kind: 'tool', importance: 'required', quote: 'Node.js' },
      ],
    } as unknown as CVData;
    expect(dismissedOf(mixed)).toEqual([{ id: 'node-js', label: 'Node.js', variants: [], kind: 'tool' }]);
  });

  // A kind that no longer exists is no skill: it takes nothing out
  it('takes nothing out for a kind it does not know', () => {
    const odd = { ...CV, dismissedRequirements: [{ id: 'node-js', label: 'Node.js', variants: [], kind: 'diploma' }] } as unknown as CVData;
    expect(withoutDismissed(odd).experience[0].description).toEqual(ACME.description);
  });
});
