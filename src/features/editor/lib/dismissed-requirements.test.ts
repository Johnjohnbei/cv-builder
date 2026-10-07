import { describe, it, expect } from 'vitest';
import type { CVData, JobRequirement } from '@/src/shared/types';
import { withDismissed, withoutDismissed } from './dismissed-requirements';

const requirement = (id: string, label: string, variants: string[] = []): JobRequirement =>
  ({ id, label, variants, kind: 'tool', importance: 'required', quote: label });
const NODE = requirement('node-js', 'Node.js');
const FIGMA = requirement('figma', 'Figma');

const CV: CVData = {
  personal_info: {
    name: 'Alex', email: 'a@b.c',
    summary: 'Product designer en SaaS B2B. Expert Node.js et React. Six ans de parcours.',
    versions: { summary: { adapted: '', original: 'Designer produit en SaaS B2B. Six ans de parcours.' } },
  },
  experience: [
    {
      company: 'Acme', position: 'Designer', start_date: '2020', current: true,
      intro: 'Équipe paiement, Node.js.', description: ['Conçu les maquettes Figma', 'Développé en Node.js'],
      versions: { adapted: { description: [] }, original: { intro: 'Équipe paiement.', description: ['Conçu les maquettes'] } },
    },
    { company: 'Beta', position: 'UI', start_date: '2018', current: false, description: ['Déployé Node.js'], versions: { adapted: { description: [] }, original: { description: ['Dessiné les écrans'] } } },
  ],
  education: [], languages: [],
  skills: [{ category: 'tools', items: ['Figma', 'Node.js'] }, { category: 'other', items: ['Node.js'] }],
};

describe('withoutDismissed: the CV as it prints', () => {
  it('prints the CV untouched while nothing is dismissed', () => {
    expect(withoutDismissed(CV, [NODE, FIGMA])).toBe(CV);
  });

  it('leaves out every text writing a dismissed requirement, and only those', () => {
    const printed = withoutDismissed({ ...CV, dismissedRequirements: ['node-js'] }, [NODE, FIGMA]);
    expect(printed.experience[0].description).toEqual(['Conçu les maquettes Figma']);
    expect(printed.skills).toEqual([{ category: 'tools', items: ['Figma'] }]);
  });

  it('takes the imported summary, intro or bullets where they do not write it', () => {
    const printed = withoutDismissed({ ...CV, dismissedRequirements: ['node-js'] }, [NODE, FIGMA]);
    expect(printed.personal_info.summary).toBe('Designer produit en SaaS B2B. Six ans de parcours.');
    expect(printed.experience[0].intro).toBe('Équipe paiement.');
    // Every bullet wrote it: the imported ones print instead
    expect(printed.experience[1].description).toEqual(['Dessiné les écrans']);
  });

  it('empties a KPI writing it, and keeps the facts of the CV', () => {
    const cv: CVData = { ...CV, dismissedRequirements: ['node-js'], experience: [{ ...CV.experience[0], kpi: 'Migré 12 services vers Node.js', position: 'Développeur Node.js' }] };
    const [exp] = withoutDismissed(cv, [NODE]).experience;
    expect(exp.kpi).toBe('');
    expect(exp.position).toBe('Développeur Node.js');
  });

  it('keeps the other sentences of a summary with no imported version', () => {
    const cv = { ...CV, personal_info: { ...CV.personal_info, versions: undefined }, dismissedRequirements: ['node-js'] };
    expect(withoutDismissed(cv, [NODE]).personal_info.summary).toBe('Product designer en SaaS B2B. Six ans de parcours.');
  });

  it('knows a requirement by its variants, in the other language too', () => {
    const research = requirement('user-research', 'user research', ['recherche utilisateur']);
    const cv: CVData = { ...CV, dismissedRequirements: ['user-research'], experience: [{ ...CV.experience[0], description: ['Mené la recherche utilisateur', 'Livré'] }] };
    expect(withoutDismissed(cv, [research]).experience[0].description).toEqual(['Livré']);
  });

  it('keeps the CV\'s own texts: "Remettre" prints them again', () => {
    const dismissed = withDismissed(CV, 'node-js', true);
    expect(dismissed.experience).toBe(CV.experience);
    const restored = withDismissed(dismissed, 'node-js', false);
    expect(restored.dismissedRequirements).toEqual([]);
    expect(withoutDismissed(restored, [NODE])).toBe(restored);
  });

  it('dismisses an id once', () => {
    expect(withDismissed(withDismissed(CV, 'figma', true), 'figma', true).dismissedRequirements).toEqual(['figma']);
  });
});
