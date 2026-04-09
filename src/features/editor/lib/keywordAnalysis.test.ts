import { describe, it, expect } from 'vitest';
import { extractAcronyms, computeKeywordAnalysis } from './keywordAnalysis';
import type { CVData } from '@/src/shared/types';
import { EMPTY_CV } from '@/src/shared/types';

// ─── Helper to build minimal CVData fixtures ───

function makeCVData(overrides: Partial<CVData> = {}): CVData {
  return { ...EMPTY_CV, ...overrides };
}

// ─── extractAcronyms ───

describe('extractAcronyms', () => {
  it('Test 1: extracts uppercase acronyms (2-5 chars)', () => {
    const result = extractAcronyms('Looking for PMP certified AWS architect');
    expect(result).toContain('PMP');
    expect(result).toContain('AWS');
    expect(result.length).toBe(2);
  });

  it('Test 2: returns empty for text without acronyms', () => {
    const result = extractAcronyms('no acronyms here in lowercase');
    expect(result).toEqual([]);
  });

  it('Test 3: detects slash-separated acronyms like CI/CD', () => {
    const result = extractAcronyms('Use CI/CD pipelines');
    expect(result).toContain('CI');
    expect(result).toContain('CD');
  });
});

// ─── computeKeywordAnalysis ───

describe('computeKeywordAnalysis', () => {
  it('Test 4: returns found=true when keyword is present in CV', () => {
    const cv = makeCVData({
      experience: [{
        company: 'Acme',
        position: 'Project Manager',
        start_date: '2020',
        current: false,
        description: ['Led project management initiatives'],
      }],
    });
    const result = computeKeywordAnalysis(cv, 'project management skills needed', 'en');
    const pm = result.keywords.find(k => k.keyword === 'project management');
    expect(pm).toBeDefined();
    expect(pm!.found).toBe(true);
  });

  it('Test 5: word-boundary prevents Java matching JavaScript (D-06)', () => {
    const cv = makeCVData({
      skills: [{ category: 'Tech', items: ['JavaScript'] }],
    });
    const result = computeKeywordAnalysis(cv, 'Java developer', 'en');
    const java = result.keywords.find(k => k.keyword === 'java');
    // "java" should NOT be found because CV only has "JavaScript"
    if (java) {
      expect(java.found).toBe(false);
    }
  });

  it('Test 6: locations indicate which sections matched', () => {
    const cv = makeCVData({
      experience: [{
        company: 'Acme',
        position: 'Developer',
        start_date: '2020',
        current: false,
        description: ['Used Python for data analysis'],
      }],
      skills: [{ category: 'Tech', items: ['Python'] }],
    });
    const result = computeKeywordAnalysis(cv, 'Python developer', 'en');
    const python = result.keywords.find(k => k.keyword === 'python');
    expect(python).toBeDefined();
    expect(python!.found).toBe(true);
    expect(python!.locations).toContain('experience');
    expect(python!.locations).toContain('skills');
  });

  it('Test 7: acronym in JD without expanded form in CV returns found=false (D-10)', () => {
    const cv = makeCVData({
      skills: [{ category: 'Cloud', items: ['Cloud Computing'] }],
    });
    const result = computeKeywordAnalysis(cv, 'AWS certified architect', 'en');
    const aws = result.keywords.find(k => k.keyword === 'AWS');
    expect(aws).toBeDefined();
    expect(aws!.found).toBe(false);
  });

  it('Test 8: empty job description returns empty keyword list', () => {
    const cv = makeCVData({
      skills: [{ category: 'Tech', items: ['Python'] }],
    });
    const result = computeKeywordAnalysis(cv, '', 'en');
    expect(result.keywords).toEqual([]);
    expect(result.matchedCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it('Test 9: case-insensitive matching (D-07)', () => {
    const cv = makeCVData({
      skills: [{ category: 'Tech', items: ['python'] }],
    });
    const result = computeKeywordAnalysis(cv, 'Python developer', 'en');
    const python = result.keywords.find(k => k.keyword === 'python');
    expect(python).toBeDefined();
    expect(python!.found).toBe(true);
  });

  it('Test 10: keywords matched against all CV text sections (D-08)', () => {
    const cv = makeCVData({
      personal_info: {
        name: 'John',
        email: 'john@test.com',
        title: 'Senior Developer',
        summary: 'Experienced with Docker containerization',
      },
      experience: [{
        company: 'Corp',
        position: 'Engineer',
        start_date: '2020',
        current: false,
        description: ['Managed Kubernetes clusters'],
      }],
      skills: [{ category: 'Tech', items: ['Terraform'] }],
      education: [{
        school: 'MIT',
        degree: 'MSc',
        field: 'Cloud Computing',
        start_date: '2015',
        end_date: '2017',
      }],
    });
    const result = computeKeywordAnalysis(cv, 'Docker Kubernetes Terraform cloud', 'en');
    const docker = result.keywords.find(k => k.keyword === 'docker');
    const kubernetes = result.keywords.find(k => k.keyword === 'kubernetes');
    const terraform = result.keywords.find(k => k.keyword === 'terraform');
    const cloud = result.keywords.find(k => k.keyword === 'cloud');

    if (docker) {
      expect(docker.found).toBe(true);
      expect(docker.locations).toContain('summary');
    }
    if (kubernetes) {
      expect(kubernetes.found).toBe(true);
      expect(kubernetes.locations).toContain('experience');
    }
    if (terraform) {
      expect(terraform.found).toBe(true);
      expect(terraform.locations).toContain('skills');
    }
    if (cloud) {
      expect(cloud.found).toBe(true);
      expect(cloud.locations).toContain('education');
    }
  });
});
