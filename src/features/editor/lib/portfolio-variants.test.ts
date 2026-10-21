import { describe, it, expect, vi } from 'vitest';
import type { PersonalInfo } from '@/src/shared/types';
import { offerTitleOf, portfolioIn, rankPortfolioVariants, withSuggestedPortfolio, type PortfolioVariant } from './portfolio-variants';
import { maskPersonalInfo } from '@/src/shared/lib/anonymize';

const VARIANTS: PortfolioVariant[] = [
  {
    id: 'design-system',
    label: 'Portfolio : Design System',
    url: 'https://example.com/portfolio/design-system',
    anonUrl: 'https://example.com/cv/abcd',
    keywords: ['design system', 'tokens', 'Figma', 'composants'],
    en: { url: 'https://example.com/portfolio/design-system?lang=EN', anonUrl: 'https://example.com/cv/abcd-en' },
  },
  {
    id: 'ai-product',
    label: 'Portfolio : IA',
    url: 'https://example.com/portfolio/ai-product',
    keywords: ['IA', 'LLM', 'agents', 'generative'],
  },
];

/** The suggestion the UI shows: the top entry, only when it matched something */
const suggest = (variants: PortfolioVariant[], jd: string) => {
  const [top] = rankPortfolioVariants(variants, jd);
  return top && top.hits > 0 ? top : null;
};

describe('rankPortfolioVariants', () => {
  it('ranks first the variant the offer mentions most', () => {
    const jd = "Vous piloterez notre design system sous Figma, avec des tokens partages.";
    expect(suggest(VARIANTS, jd)?.variant.id).toBe('design-system');
  });

  it('ranks a different variant first for a different offer', () => {
    const jd = "Poste oriente IA : concevoir des agents LLM pour nos produits generative.";
    expect(suggest(VARIANTS, jd)?.variant.id).toBe('ai-product');
  });

  it('suggests nothing rather than an unrelated portfolio', () => {
    expect(suggest(VARIANTS, 'Recherche comptable confirme, logiciel Sage.')).toBeNull();
  });

  it('suggests nothing without a job description, but still lists every variant', () => {
    const ranked = rankPortfolioVariants(VARIANTS, '   ');
    expect(ranked.map(m => m.variant.id)).toEqual(['design-system', 'ai-product']);
    expect(ranked.every(m => m.hits === 0)).toBe(true);
  });

  it('returns an empty list when no variant is configured', () => {
    expect(rankPortfolioVariants([], 'design system Figma')).toEqual([]);
  });

  it('matches on word boundaries, not substrings', () => {
    const variants: PortfolioVariant[] = [
      { id: 'x', label: 'X', url: 'https://e.com/x', keywords: ['IA'] },
    ];
    // "IA" must not match inside "IATA" or "biais"
    expect(suggest(variants, 'Codes IATA et gestion des biais.')).toBeNull();
    expect(suggest(variants, 'Produits IA en production.')?.variant.id).toBe('x');
  });

  it('reports how many keywords matched', () => {
    const jd = 'design system, tokens et Figma';
    expect(suggest(VARIANTS, jd)?.hits).toBe(3);
  });

  // Real offers carry accents the config spelling does not: this is why the
  // suggestion never appeared on French offers.
  it('ignores accents in the offer and in the keywords', () => {
    const variants: PortfolioVariant[] = [
      { id: 'ds', label: 'DS', url: 'https://e.com/ds', keywords: ['systeme de design', 'accessibilité', 'equipe design'] },
    ];
    const jd = "Vous piloterez le Système de Design, garant de l'accessibilite, au sein de l'équipe design.";
    expect(suggest(variants, jd)?.hits).toBe(3);
  });

  it('tolerates plurals', () => {
    const variants: PortfolioVariant[] = [
      { id: 'ds', label: 'DS', url: 'https://e.com/ds', keywords: ['design token', 'composant'] },
    ];
    expect(suggest(variants, 'Des design tokens et des composants partagés.')?.hits).toBe(2);
  });

  it('keeps a multi-word keyword contiguous', () => {
    const variants: PortfolioVariant[] = [
      { id: 'lead', label: 'Lead', url: 'https://e.com/lead', keywords: ['equipe design'] },
    ];
    expect(suggest(variants, "Une équipe produit soudée. Le design est au cœur du poste.")).toBeNull();
  });

  it('breaks ties by declaration order', () => {
    const jd = 'Figma et LLM';
    expect(rankPortfolioVariants(VARIANTS, jd).map(m => m.variant.id)).toEqual(['design-system', 'ai-product']);
  });

  // A lead offer writes the vocabulary of every design offer: counted alone, it suggested the generic version
  describe('the offer job title decides first', () => {
    const ROLES: PortfolioVariant[] = [
      { id: 'pd', label: 'Product Designer', url: 'https://e.com/pd', keywords: ['product designer', 'figma', 'wireframe', 'recherche utilisateur', 'parcours utilisateur'] },
      { id: 'lead', label: 'Head of Design', url: 'https://e.com/lead', keywords: ['lead product designer', 'management', 'stakeholders'] },
      { id: 'ds', label: 'Design System', url: 'https://e.com/ds', keywords: ['design system', 'design systems', 'tokens'] },
    ];
    const LEAD_JD = "Lead Product Designer. Vous encadrez l'équipe : management, stakeholders, parcours utilisateur, "
      + 'wireframe et recherche utilisateur sur Figma, évolution du design system.';

    it('suggests the version its most specific keyword names, before the keyword count', () => {
      expect(rankPortfolioVariants(ROLES, LEAD_JD, '').map(m => m.variant.id)[0]).toBe('pd');
      expect(rankPortfolioVariants(ROLES, LEAD_JD, 'Lead Product Designer').map(m => m.variant.id)).toEqual(['lead', 'pd', 'ds']);
    });

    it('applies it to the CV proposed for the offer', () => {
      const out = withSuggestedPortfolio<{ personal_info: PersonalInfo }>({ personal_info: { name: 'J', email: 'j@e.com' } }, LEAD_JD, 'Lead Product Designer', ROLES);
      expect(out.personal_info.portfolio_url).toBe('https://e.com/lead');
    });

    it('counts a plural once and names the terms found', () => {
      const ds = rankPortfolioVariants(ROLES, 'Nos design systems et leurs tokens.', '').find(m => m.variant.id === 'ds')!;
      expect(ds.hits).toBe(2);
      expect(ds.terms).toEqual(['design system', 'tokens']);
    });

    it('reads the title from the first requirement of kind title', () => {
      const req = (label: string, kind: string) => ({ id: label, label, kind, importance: 'required', quote: label, variants: [] }) as never;
      expect(offerTitleOf([req('Figma', 'tool'), req('Lead Product Designer', 'title'), req('Head of Design', 'title')])).toBe('Lead Product Designer');
      expect(offerTitleOf([req('Figma', 'tool')])).toBe('');
    });

    it('never ranks a version the offer text does not mention before one it does', () => {
      const ranked = rankPortfolioVariants(ROLES, 'Vos tokens et le design system.', 'Lead Product Designer');
      expect(ranked[0].variant.id).toBe('ds');
    });
  });
});

describe('withSuggestedPortfolio', () => {
  const DS_JD = 'Vous piloterez notre design system sous Figma.';
  const cv = (portfolio_url?: string): { personal_info: PersonalInfo } =>
    ({ personal_info: { name: 'Jane', email: 'j@e.com', portfolio_url } });

  it('links the best-matching variant on a proposed CV', () => {
    const out = withSuggestedPortfolio(cv(), DS_JD, '', VARIANTS);
    expect(out.personal_info.portfolio_url).toBe('https://example.com/portfolio/design-system');
    expect(out.personal_info.portfolio_label).toBe('Portfolio : Design System');
    expect(out.personal_info.portfolio_anon_url).toBe('https://example.com/cv/abcd');
  });

  it('swaps a previously linked variant for the one this offer calls for', () => {
    const out = withSuggestedPortfolio(cv('https://example.com/portfolio/ai-product'), DS_JD, '', VARIANTS);
    expect(out.personal_info.portfolio_url).toBe('https://example.com/portfolio/design-system');
  });

  it('never replaces a link typed by hand', () => {
    const input = cv('https://my-site.com');
    expect(withSuggestedPortfolio(input, DS_JD, '', VARIANTS)).toBe(input);
  });

  it('leaves the CV untouched when nothing matches', () => {
    const input = cv();
    expect(withSuggestedPortfolio(input, 'Comptable confirme, logiciel Sage.', '', VARIANTS)).toBe(input);
  });
});

describe('portfolioIn: the link in the language the CV prints in', () => {
  const ds = VARIANTS[0];
  const link = (url: string, label = ds.label) => ({ url, label });

  it('links the English version on an English CV, the default one on a French CV', () => {
    expect(portfolioIn(link(ds.url), 'en', VARIANTS).url).toBe(ds.en!.url);
    expect(portfolioIn(link(ds.en!.url), 'fr', VARIANTS).url).toBe(ds.url);
  });

  it('swaps the anonymous link too', () => {
    expect(portfolioIn(link(ds.anonUrl!, 'Portfolio'), 'en', VARIANTS)).toEqual({ url: ds.en!.anonUrl, label: 'Portfolio' });
  });

  it('prints a variant with no English version, and a link typed by hand, as they are', () => {
    const ai = VARIANTS[1];
    expect(portfolioIn(link(ai.url, ai.label), 'en', VARIANTS).url).toBe(ai.url);
    expect(portfolioIn(link('https://me.dev'), 'en', VARIANTS)).toEqual(link('https://me.dev'));
  });

  it('takes the English label when there is one and the CV carries the default', () => {
    const named = [{ ...ds, en: { ...ds.en!, label: 'Portfolio: Design System' } }];
    expect(portfolioIn(link(ds.url), 'en', named).label).toBe('Portfolio: Design System');
    expect(portfolioIn(link(ds.url, 'Mon portfolio'), 'en', named).label).toBe('Mon portfolio');
  });
});

describe('getPortfolioVariants', () => {
  // A typo in the English block took the whole variant, French link included, without a word
  it('drops a malformed English version alone, keeping the variant', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_PORTFOLIO_VARIANTS', JSON.stringify([{ ...VARIANTS[0], en: { label: 'Portfolio' } }]));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { getPortfolioVariants } = await import('./portfolio-variants');
      const [variant] = getPortfolioVariants();
      expect(variant).toMatchObject({ id: 'design-system', url: VARIANTS[0].url });
      expect(variant.en).toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      warn.mockRestore();
    }
  });
});

describe('maskPersonalInfo', () => {
  // The city names nobody, and a recruiter filters on it (arbitrage of 2026-10-07)
  it('keeps the city of an anonymous CV', () => {
    const source = { personal_info: { name: 'Alex', email: 'a@b.c', location: 'Paris, France' }, experience: [], education: [], skills: [], languages: [] };
    const masked = maskPersonalInfo(source);
    expect(masked.personal_info).toMatchObject({ location: 'Paris, France', email: '' });
  });
});
