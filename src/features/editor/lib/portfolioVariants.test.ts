import { describe, it, expect } from 'vitest';
import { pickPortfolioVariant, type PortfolioVariant } from './portfolioVariants';

const VARIANTS: PortfolioVariant[] = [
  {
    id: 'design-system',
    label: 'Portfolio : Design System',
    url: 'https://example.com/portfolio/design-system',
    anonUrl: 'https://example.com/cv/abcd',
    keywords: ['design system', 'tokens', 'Figma', 'composants'],
  },
  {
    id: 'ai-product',
    label: 'Portfolio : IA',
    url: 'https://example.com/portfolio/ai-product',
    keywords: ['IA', 'LLM', 'agents', 'generative'],
  },
];

describe('pickPortfolioVariant', () => {
  it('picks the variant the offer mentions most', () => {
    const jd = "Vous piloterez notre design system sous Figma, avec des tokens partages.";
    expect(pickPortfolioVariant(VARIANTS, jd)?.variant.id).toBe('design-system');
  });

  it('picks a different variant for a different offer', () => {
    const jd = "Poste oriente IA : concevoir des agents LLM pour nos produits generative.";
    expect(pickPortfolioVariant(VARIANTS, jd)?.variant.id).toBe('ai-product');
  });

  it('returns null rather than suggesting an unrelated portfolio', () => {
    expect(pickPortfolioVariant(VARIANTS, 'Recherche comptable confirme, logiciel Sage.')).toBeNull();
  });

  it('returns null without a job description', () => {
    expect(pickPortfolioVariant(VARIANTS, '   ')).toBeNull();
  });

  it('returns null when no variant is configured', () => {
    expect(pickPortfolioVariant([], 'design system Figma')).toBeNull();
  });

  it('matches on word boundaries, not substrings', () => {
    const variants: PortfolioVariant[] = [
      { id: 'x', label: 'X', url: 'https://e.com/x', keywords: ['IA'] },
    ];
    // "IA" must not match inside "IATA" or "biais"
    expect(pickPortfolioVariant(variants, 'Codes IATA et gestion des biais.')).toBeNull();
    expect(pickPortfolioVariant(variants, 'Produits IA en production.')?.variant.id).toBe('x');
  });

  it('reports how many keywords matched', () => {
    const jd = 'design system, tokens et Figma';
    expect(pickPortfolioVariant(VARIANTS, jd)?.hits).toBe(3);
  });
});
