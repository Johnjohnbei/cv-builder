import { describe, it, expect } from 'vitest';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { EMPTY_CV, DEFAULT_DESIGN } from '@/src/shared/types';
import { computeATSScore } from '@/src/features/editor/lib/scoring';
import { computeKeywordAnalysis } from '@/src/features/editor/lib/keywordAnalysis';
import { getCVLanguage } from '@/src/lib/languageDetection';

// ─── Helpers ───

function makeCVData(overrides: Partial<CVData> = {}): CVData {
  return {
    ...EMPTY_CV,
    personal_info: {
      name: 'Jean Dupont',
      email: 'jean@example.com',
      title: 'Software Engineer',
      summary: 'Experienced software engineer with expertise in React and TypeScript.',
      phone: '+33612345678',
    },
    experience: [
      {
        company: 'Acme Corp',
        position: 'Senior Developer',
        start_date: '2020',
        end_date: '2024',
        current: false,
        description: [
          'Built React applications serving 50,000 users',
          'Improved CI/CD pipeline reducing deploy time by 40%',
        ],
      },
    ],
    education: [
      { school: 'Universite Paris', degree: 'Master', field: 'Computer Science', start_date: '2015', end_date: '2020' },
    ],
    skills: [
      { category: 'Frontend', items: ['React', 'TypeScript', 'Tailwind CSS'] },
      { category: 'Backend', items: ['Node.js', 'PostgreSQL'] },
    ],
    languages: [{ name: 'French', proficiency: 'Native' }],
    ...overrides,
  };
}

function makeDesign(overrides: Partial<DesignSettings> = {}): DesignSettings {
  return { ...DEFAULT_DESIGN, ...overrides };
}

// ─── Pure logic tests (mirrors hook delegation) ───

describe('useATSAnalysis delegation logic', () => {
  describe('null cvData', () => {
    it('returns null score when cvData is null', () => {
      const cvData: CVData | null = null;
      const score = cvData ? computeATSScore(cvData, makeDesign()) : null;
      expect(score).toBeNull();
    });

    it('returns empty keywords when cvData is null', () => {
      const cvData: CVData | null = null;
      const hasJD = 'some job'.trim().length > 0;
      const keywords =
        cvData && hasJD
          ? computeKeywordAnalysis(cvData, 'some job', 'fr')
          : { keywords: [], matchedCount: 0, totalCount: 0 };
      expect(keywords.keywords).toEqual([]);
      expect(keywords.matchedCount).toBe(0);
      expect(keywords.totalCount).toBe(0);
    });
  });

  describe('without job description', () => {
    it('returns score with relevance null', () => {
      const cv = makeCVData();
      const score = computeATSScore(cv, makeDesign(), '');
      expect(score).not.toBeNull();
      expect(score.relevance).toBeNull();
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });

    it('returns empty keywords', () => {
      const cv = makeCVData();
      const hasJD = ''.trim().length > 0;
      const keywords = hasJD
        ? computeKeywordAnalysis(cv, '', 'fr')
        : { keywords: [], matchedCount: 0, totalCount: 0 };
      expect(keywords.keywords).toEqual([]);
    });

    it('hasJobDescription is false for empty string', () => {
      const hasJD = ''.trim().length > 0;
      expect(hasJD).toBe(false);
    });

    it('hasJobDescription is false for whitespace-only', () => {
      const hasJD = '   '.trim().length > 0;
      expect(hasJD).toBe(false);
    });
  });

  describe('with job description', () => {
    const JD = 'Looking for a Senior React Developer with TypeScript and Node.js experience. CI/CD knowledge required.';

    it('returns score with relevance as number', () => {
      const cv = makeCVData();
      const score = computeATSScore(cv, makeDesign(), JD);
      expect(score.relevance).toBeTypeOf('number');
      expect(score.relevance).toBeGreaterThanOrEqual(0);
      expect(score.relevance).toBeLessThanOrEqual(100);
    });

    it('returns populated keywords', () => {
      const cv = makeCVData();
      const lang = getCVLanguage(cv);
      const result = computeKeywordAnalysis(cv, JD, lang);
      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('matched keywords have locations', () => {
      const cv = makeCVData();
      const lang = getCVLanguage(cv);
      const result = computeKeywordAnalysis(cv, JD, lang);
      const matched = result.keywords.filter(k => k.found);
      expect(matched.length).toBeGreaterThan(0);
      for (const kw of matched) {
        expect(kw.locations.length).toBeGreaterThan(0);
      }
    });

    it('hasJobDescription is true for non-empty JD', () => {
      const hasJD = JD.trim().length > 0;
      expect(hasJD).toBe(true);
    });
  });

  describe('language detection', () => {
    it('defaults to fr when cvData has no language override', () => {
      const cv = makeCVData();
      expect(getCVLanguage(cv)).toBe('fr');
    });

    it('respects languageOverride', () => {
      const cv = makeCVData({ languageOverride: 'en' });
      expect(getCVLanguage(cv)).toBe('en');
    });
  });
});
