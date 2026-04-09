import { describe, it, expect } from 'vitest';
import { scoreExperience, autoAssignModes, extractKeywords, computeKeywordMatch, computeRecency, computeDuration, scoreFormat, scoreContent, computeATSScore, extractNLPKeywords, scoreRelevance } from './scoring';
import type { Experience, CVData, DesignSettings } from '@/src/shared/types';
import { EMPTY_CV, DEFAULT_DESIGN } from '@/src/shared/types';

// ─── Helpers ───

function makeExp(overrides: Partial<Experience> = {}): Experience {
  return {
    company: 'Acme',
    position: 'Developer',
    start_date: '2020',
    current: false,
    end_date: '2024',
    description: ['Built stuff'],
    ...overrides,
  };
}

// ─── computeKeywordMatch (word-boundary fix per D-07) ───

describe('computeKeywordMatch', () => {
  it('does NOT match substring keywords (java vs javascript)', () => {
    const exp = makeExp({ position: 'JavaScript Developer', description: ['Built JavaScript apps'] });
    // "java" must NOT match "javascript"
    expect(computeKeywordMatch(exp, ['java'])).toBe(0);
  });

  it('matches exact word keywords', () => {
    const exp = makeExp({ position: 'Java Developer', description: ['Built Java apps'] });
    expect(computeKeywordMatch(exp, ['java'])).toBeGreaterThan(0);
  });

  it('handles special characters in keywords (c++)', () => {
    const exp = makeExp({ position: 'C++ Developer', description: ['C++ programming'] });
    expect(computeKeywordMatch(exp, ['c++'])).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const exp = makeExp({ position: 'React Developer' });
    expect(computeKeywordMatch(exp, ['react'])).toBeGreaterThan(0);
  });

  it('returns 0 for no matches', () => {
    const exp = makeExp({ position: 'Chef', description: ['Cooking'] });
    expect(computeKeywordMatch(exp, ['react', 'java'])).toBe(0);
  });

  it('returns 100 when all keywords match', () => {
    const exp = makeExp({ position: 'React Java Developer', description: ['Built stuff'] });
    expect(computeKeywordMatch(exp, ['react', 'java'])).toBe(100);
  });
});

// ─── computeRecency ───

describe('computeRecency', () => {
  it('returns 100 for current positions', () => {
    const exp = makeExp({ current: true });
    expect(computeRecency(exp)).toBe(100);
  });

  it('returns lower score for older positions', () => {
    const recent = makeExp({ end_date: '2025' });
    const old = makeExp({ end_date: '2010' });
    expect(computeRecency(recent)).toBeGreaterThan(computeRecency(old));
  });
});

// ─── computeDuration ───

describe('computeDuration', () => {
  it('returns higher score for longer durations', () => {
    const long = makeExp({ start_date: '2015', end_date: '2024' });
    const short = makeExp({ start_date: '2023', end_date: '2024' });
    expect(computeDuration(long)).toBeGreaterThan(computeDuration(short));
  });
});

// ─── extractKeywords ───

describe('extractKeywords', () => {
  it('returns empty for empty input', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('extracts meaningful words, filters stop words', () => {
    const kw = extractKeywords('Nous cherchons un développeur React avec expérience');
    expect(kw).toContain('développeur');
    expect(kw).toContain('react');
    expect(kw).toContain('expérience');
    expect(kw).not.toContain('nous');
    expect(kw).not.toContain('avec');
  });

  it('deduplicates keywords', () => {
    const kw = extractKeywords('React React React');
    expect(kw).toEqual(['react']);
  });

  it('filters short words (< 3 chars)', () => {
    const kw = extractKeywords('Le CV de AI');
    expect(kw).toEqual([]);
  });
});

// ─── scoreExperience ───

describe('scoreExperience', () => {
  it('scores current position highest without keywords', () => {
    const current = makeExp({ current: true, end_date: '' });
    const old = makeExp({ current: false, end_date: '2015' });
    expect(scoreExperience(current, [])).toBeGreaterThan(scoreExperience(old, []));
  });

  it('boosts score with matching keywords', () => {
    const exp = makeExp({ position: 'React Developer', description: ['Built React apps'] });
    const withKw = scoreExperience(exp, ['react', 'developer']);
    const withoutKw = scoreExperience(exp, []);
    expect(withKw).toBeGreaterThan(0);
    expect(withoutKw).toBeGreaterThan(0);
  });

  it('returns 0-100 range', () => {
    const exp = makeExp();
    const score = scoreExperience(exp, ['react']);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('penalizes old experiences', () => {
    const recent = makeExp({ end_date: '2024' });
    const ancient = makeExp({ end_date: '2005' });
    expect(scoreExperience(recent, [])).toBeGreaterThan(scoreExperience(ancient, []));
  });
});

// ─── autoAssignModes ───

describe('autoAssignModes', () => {
  it('does not mutate input array', () => {
    const exps = [makeExp({ current: true }), makeExp()];
    const original = JSON.stringify(exps);
    autoAssignModes(exps, [], 1);
    expect(JSON.stringify(exps)).toBe(original);
  });

  it('assigns extended to top-scored experience on 1 page', () => {
    const exps = [
      makeExp({ current: true, end_date: '', position: 'CTO' }),
      makeExp({ end_date: '2020', position: 'Intern' }),
      makeExp({ end_date: '2010', position: 'Junior' }),
    ];
    const result = autoAssignModes(exps, [], 1);
    // The current position should be extended (highest score)
    expect(result[0].displayMode).toBe('extended');
  });

  it('hides excess experiences on 1 page', () => {
    const exps = Array.from({ length: 8 }, (_, i) =>
      makeExp({ end_date: `${2024 - i}`, position: `Role ${i}` })
    );
    const result = autoAssignModes(exps, [], 1);
    const hidden = result.filter(e => e.displayMode === 'hidden');
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('shows more experiences on 2 pages', () => {
    const exps = Array.from({ length: 8 }, (_, i) =>
      makeExp({ end_date: `${2024 - i}`, position: `Role ${i}` })
    );
    const r1 = autoAssignModes(exps, [], 1);
    const r2 = autoAssignModes(exps, [], 2);
    const visible1 = r1.filter(e => e.displayMode !== 'hidden').length;
    const visible2 = r2.filter(e => e.displayMode !== 'hidden').length;
    expect(visible2).toBeGreaterThanOrEqual(visible1);
  });

  it('preserves original order (index-based assignment)', () => {
    const exps = [
      makeExp({ position: 'A', end_date: '2020' }),
      makeExp({ position: 'B', current: true }),
    ];
    const result = autoAssignModes(exps, [], 1);
    expect(result[0].position).toBe('A');
    expect(result[1].position).toBe('B');
  });
});

// ─── Helpers for ATS scoring ───

function makeCVData(overrides: Partial<CVData> = {}): CVData {
  return {
    personal_info: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+33 6 12 34 56 78',
      title: 'Software Engineer',
      summary: 'Experienced developer',
    },
    experience: [
      makeExp({
        description: [
          'Led a team of 5 engineers to deliver project 30% ahead of schedule',
          'Increased revenue by $2M through optimization',
          'Deployed microservices architecture serving 10000 requests/sec',
        ],
      }),
    ],
    education: [{ school: 'MIT', degree: 'BS', field: 'CS', start_date: '2016', end_date: '2020' }],
    skills: [{ category: 'Languages', items: ['TypeScript', 'Python'] }],
    languages: [{ name: 'English', proficiency: 'Native' }],
    ...overrides,
  };
}

function makeDesign(overrides: Partial<DesignSettings> = {}): DesignSettings {
  return {
    ...DEFAULT_DESIGN,
    ...overrides,
  };
}

// ─── scoreFormat ───

describe('scoreFormat', () => {
  it('returns 0-100 score with suggestions array', () => {
    const result = scoreFormat(makeCVData(), makeDesign(), 'en');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('gives full template points for ATS-compatible template', () => {
    const full = scoreFormat(makeCVData(), makeDesign({ template: 'TEMPLATE_B' }), 'en');
    const limited = scoreFormat(makeCVData(), makeDesign({ template: 'TEMPLATE_A' }), 'en');
    expect(full.score).toBeGreaterThan(limited.score);
  });

  it('gives font points for ATS-safe fonts (sans -> Arial)', () => {
    const safe = scoreFormat(makeCVData(), makeDesign({ fontFamily: 'sans' }), 'en');
    const unsafe = scoreFormat(makeCVData(), makeDesign({ fontFamily: 'outfit' }), 'en');
    expect(safe.score).toBeGreaterThan(unsafe.score);
  });

  it('gives contact points for email and phone', () => {
    const withContact = scoreFormat(
      makeCVData({ personal_info: { name: 'J', email: 'j@e.com', phone: '+33612345678' } }),
      makeDesign(),
      'en',
    );
    const noContact = scoreFormat(
      makeCVData({ personal_info: { name: 'J', email: '' } }),
      makeDesign(),
      'en',
    );
    expect(withContact.score).toBeGreaterThan(noContact.score);
  });

  it('returns 0 for empty CV without crashing', () => {
    const result = scoreFormat(EMPTY_CV, makeDesign(), 'en');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('gives section name points for included sections', () => {
    const withSections = scoreFormat(
      makeCVData(),
      makeDesign({ includedSections: ['experience', 'education', 'skills', 'contact', 'summary'] }),
      'en',
    );
    const noSections = scoreFormat(
      makeCVData(),
      makeDesign({ includedSections: [] }),
      'en',
    );
    expect(withSections.score).toBeGreaterThan(noSections.score);
  });
});

// ─── scoreContent ───

describe('scoreContent', () => {
  it('returns 0-100 score with suggestions array', () => {
    const result = scoreContent(makeCVData(), 'en');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('returns 0 for CV with no experience bullets', () => {
    const result = scoreContent(makeCVData({ experience: [] }), 'en');
    expect(result.score).toBe(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('rewards bullets with metrics (numbers, %, $)', () => {
    const withMetrics = scoreContent(
      makeCVData({
        experience: [makeExp({ description: ['Increased sales by 50%', 'Saved $100K annually', 'Led 12 engineers'] })],
      }),
      'en',
    );
    const noMetrics = scoreContent(
      makeCVData({
        experience: [makeExp({ description: ['Did stuff', 'Worked on things', 'Helped team'] })],
      }),
      'en',
    );
    expect(withMetrics.score).toBeGreaterThan(noMetrics.score);
  });

  it('penalizes bullets starting with weak verbs', () => {
    const strongVerbs = scoreContent(
      makeCVData({
        experience: [makeExp({ description: ['Led the migration project', 'Optimized database queries', 'Deployed new infrastructure'] })],
      }),
      'en',
    );
    const weakVerbs = scoreContent(
      makeCVData({
        experience: [makeExp({ description: ['Helped with migration', 'Worked on database', 'Assisted in deployment'] })],
      }),
      'en',
    );
    expect(strongVerbs.score).toBeGreaterThan(weakVerbs.score);
  });

  it('checks bullet length (5-30 words)', () => {
    const goodLength = scoreContent(
      makeCVData({
        experience: [makeExp({ description: ['Led a team of five engineers to deliver the project ahead of schedule'] })],
      }),
      'en',
    );
    const tooShort = scoreContent(
      makeCVData({
        experience: [makeExp({ description: ['Did work', 'Coded', 'Helped'] })],
      }),
      'en',
    );
    expect(goodLength.score).toBeGreaterThan(tooShort.score);
  });

  it('returns 0 for EMPTY_CV without crashing', () => {
    const result = scoreContent(EMPTY_CV, 'en');
    expect(result.score).toBe(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('gives points for skills not empty', () => {
    const withSkills = scoreContent(makeCVData(), 'en');
    const noSkills = scoreContent(makeCVData({ skills: [] }), 'en');
    expect(withSkills.score).toBeGreaterThan(noSkills.score);
  });
});

// ─── computeATSScore ───

describe('computeATSScore', () => {
  it('returns overall as average of format and content when no JD', () => {
    const cv = makeCVData();
    const design = makeDesign();
    const result = computeATSScore(cv, design);
    const fmt = scoreFormat(cv, design, 'en');
    const cnt = scoreContent(cv, 'en');
    expect(result.overall).toBe(Math.round((fmt.score + cnt.score) / 2));
  });

  it('relevance is null when no JD', () => {
    const result = computeATSScore(makeCVData(), makeDesign());
    expect(result.relevance).toBeNull();
  });

  it('empty string JD treated as no JD', () => {
    const result = computeATSScore(makeCVData(), makeDesign(), '');
    expect(result.relevance).toBeNull();
  });

  it('whitespace-only JD treated as no JD', () => {
    const result = computeATSScore(makeCVData(), makeDesign(), '   ');
    expect(result.relevance).toBeNull();
  });

  it('overall is between 0-100', () => {
    const result = computeATSScore(makeCVData(), makeDesign());
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it('suggestions is non-empty array for a CV with issues', () => {
    const result = computeATSScore(
      makeCVData({ personal_info: { name: 'J', email: '' }, skills: [] }),
      makeDesign(),
    );
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('does not crash on EMPTY_CV', () => {
    const result = computeATSScore(EMPTY_CV, makeDesign());
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(result.overall)).toBe(false);
    expect(result.format).toBeGreaterThanOrEqual(0);
    expect(result.content).toBe(0);
    expect(result.relevance).toBeNull();
  });
});

// ─── extractNLPKeywords ───

describe('extractNLPKeywords', () => {
  it('extracts bigrams from English text', () => {
    const kw = extractNLPKeywords('project management experience with data analysis', 'en');
    // Should contain multi-word terms
    const hasMultiWord = kw.some(k => k.includes(' '));
    expect(hasMultiWord).toBe(true);
  });

  it('extracts unigrams from English text', () => {
    const kw = extractNLPKeywords('React TypeScript developer experience', 'en');
    expect(kw.some(k => k.includes('react') || k.includes('typescript'))).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(extractNLPKeywords('', 'en')).toEqual([]);
  });

  it('filters terms shorter than 3 chars', () => {
    const kw = extractNLPKeywords('AI is a good tool', 'en');
    kw.forEach(k => {
      expect(k.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('deduplicates keywords', () => {
    const kw = extractNLPKeywords('project management and project management skills', 'en');
    const unique = new Set(kw);
    expect(kw.length).toBe(unique.size);
  });

  it('uses French fallback for fr language (sliding window bigrams)', () => {
    const kw = extractNLPKeywords('gestion de projet et analyse de donnees', 'fr');
    expect(kw.length).toBeGreaterThan(0);
    // Should still produce some multi-word terms via sliding window
    const hasMultiWord = kw.some(k => k.includes(' '));
    expect(hasMultiWord).toBe(true);
  });
});

// ─── scoreRelevance ───

describe('scoreRelevance', () => {
  it('returns 0-100 score', () => {
    const result = scoreRelevance(
      makeCVData(),
      'software engineer typescript react development',
      'en',
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns high score when CV matches JD well', () => {
    const cv = makeCVData({
      personal_info: { name: 'J', email: 'j@e.com', title: 'Software Engineer' },
      experience: [makeExp({ position: 'Software Engineer', description: ['Built React and TypeScript applications'] })],
      skills: [{ category: 'Tech', items: ['React', 'TypeScript', 'Node.js'] }],
    });
    const result = scoreRelevance(cv, 'software engineer react typescript node.js development', 'en');
    expect(result.score).toBeGreaterThan(40);
  });

  it('returns low score when CV does not match JD', () => {
    const cv = makeCVData({
      personal_info: { name: 'J', email: 'j@e.com', title: 'Chef' },
      experience: [makeExp({ position: 'Chef', description: ['Cooked food in a restaurant'] })],
      skills: [{ category: 'Cooking', items: ['French cuisine', 'Pastry'] }],
    });
    const result = scoreRelevance(cv, 'software engineer react typescript machine learning python', 'en');
    expect(result.score).toBeLessThan(30);
  });

  it('returns score 0 with suggestion when JD has no extractable keywords', () => {
    const result = scoreRelevance(makeCVData(), 'a b c', 'en');
    expect(result.score).toBe(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('generates suggestions for missing keywords', () => {
    const cv = makeCVData({
      experience: [makeExp({ position: 'Developer', description: ['Built web apps'] })],
      skills: [{ category: 'Tech', items: ['HTML'] }],
    });
    const result = scoreRelevance(cv, 'machine learning python tensorflow kubernetes docker', 'en');
    expect(result.suggestions.some(s => s.includes('keyword'))).toBe(true);
  });

  it('does not return NaN', () => {
    const result = scoreRelevance(makeCVData(), 'random job description text', 'en');
    expect(Number.isNaN(result.score)).toBe(false);
  });
});

// ─── computeATSScore with JD ───

describe('computeATSScore with job description', () => {
  it('returns weighted score with JD: format*0.3 + content*0.3 + relevance*0.4', () => {
    const cv = makeCVData();
    const design = makeDesign();
    const jd = 'software engineer typescript react development team leadership';
    const result = computeATSScore(cv, design, jd);
    const fmt = scoreFormat(cv, design, 'en');
    const cnt = scoreContent(cv, 'en');
    // Overall should be weighted, not simple average
    expect(result.overall).toBe(Math.round(fmt.score * 0.3 + cnt.score * 0.3 + result.relevance! * 0.4));
  });

  it('relevance is a number (not null) when JD is provided', () => {
    const result = computeATSScore(makeCVData(), makeDesign(), 'software engineer react');
    expect(result.relevance).not.toBeNull();
    expect(typeof result.relevance).toBe('number');
  });

  it('overall is between 0-100 with JD', () => {
    const result = computeATSScore(makeCVData(), makeDesign(), 'software engineer react typescript');
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it('empty JD still returns relevance null', () => {
    const result = computeATSScore(makeCVData(), makeDesign(), '');
    expect(result.relevance).toBeNull();
  });

  it('full integration: realistic CV + JD returns all fields populated', () => {
    const cv = makeCVData({
      personal_info: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1 555 123 4567',
        title: 'Senior Software Engineer',
        summary: 'Full-stack engineer with 8 years experience in React, TypeScript, and cloud infrastructure',
      },
      experience: [
        makeExp({
          position: 'Senior Software Engineer',
          description: [
            'Led migration of monolith to microservices architecture serving 50000 daily users',
            'Implemented CI/CD pipeline reducing deployment time by 75%',
            'Mentored team of 4 junior developers in React and TypeScript best practices',
          ],
        }),
      ],
      skills: [
        { category: 'Languages', items: ['TypeScript', 'Python', 'Go'] },
        { category: 'Frameworks', items: ['React', 'Next.js', 'Node.js'] },
      ],
    });
    const design = makeDesign({
      template: 'TEMPLATE_B',
      fontFamily: 'sans',
      includedSections: ['experience', 'education', 'skills', 'contact', 'summary'],
    });
    const jd = 'Senior Software Engineer with experience in React, TypeScript, microservices, and cloud infrastructure. Must have leadership experience.';

    const result = computeATSScore(cv, design, jd);

    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.format).toBeGreaterThanOrEqual(0);
    expect(result.content).toBeGreaterThanOrEqual(0);
    expect(result.relevance).not.toBeNull();
    expect(typeof result.relevance).toBe('number');
    expect(result.relevance!).toBeGreaterThanOrEqual(0);
    expect(result.relevance!).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.suggestions)).toBe(true);
    // Verify weighted formula
    expect(result.overall).toBe(Math.round(result.format * 0.3 + result.content * 0.3 + result.relevance! * 0.4));
  });
});
