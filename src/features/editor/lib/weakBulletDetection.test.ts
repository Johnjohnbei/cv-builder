import { describe, it, expect } from 'vitest';
import { analyzeWeakBullets } from './weakBulletDetection';
import type { Experience } from '@/src/shared/types';

// ─── Helper to build minimal Experience fixtures ───

function makeExp(
  description: string[],
  displayMode?: Experience['displayMode'],
): Experience {
  return {
    company: 'Acme',
    position: 'Dev',
    start_date: '2024-01',
    current: false,
    description,
    displayMode,
  };
}

// ─── analyzeWeakBullets ───

describe('analyzeWeakBullets', () => {
  // ─── Weak verb detection ───

  it('Test 1: detects French weak verb "Responsable de"', () => {
    const results = analyzeWeakBullets([makeExp(["Responsable de l'équipe marketing"])]);
    expect(results.length).toBe(1);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('weak-verb');
    expect(issues).toContain('no-metrics');
  });

  it('Test 2: detects English weak verb "Worked on"', () => {
    const results = analyzeWeakBullets([makeExp(['Worked on various projects'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('weak-verb');
    expect(issues).toContain('no-metrics');
    expect(issues).toContain('too-vague');
  });

  it('Test 3: detects "helped" as weak verb', () => {
    const results = analyzeWeakBullets([makeExp(['Helped the team with tasks'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('weak-verb');
  });

  it('Test 4: detects "participé à" as weak verb', () => {
    const results = analyzeWeakBullets([makeExp(['Participé à la refonte du site web'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('weak-verb');
  });

  it('Test 5: detects "managed" without quantifier as weak verb', () => {
    const results = analyzeWeakBullets([makeExp(['Managed the marketing department operations'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('weak-verb');
  });

  // ─── No metrics detection ───

  it('Test 6: flags bullet with no digits as no-metrics', () => {
    const results = analyzeWeakBullets([makeExp(['Developed new features for the platform'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('no-metrics');
    expect(issues).not.toContain('weak-verb');
  });

  // ─── Strong bullet — no issues ───

  it('Test 7: strong French bullet returns no issues', () => {
    const results = analyzeWeakBullets([makeExp(['Augmenté le CA de 35% en 6 mois'])]);
    expect(results.length).toBe(0);
  });

  it('Test 8: strong English bullet returns no issues', () => {
    const results = analyzeWeakBullets([
      makeExp(['Led migration of 3 microservices reducing latency by 40%']),
    ]);
    expect(results.length).toBe(0);
  });

  // ─── Passive voice detection ───

  it('Test 9: detects French passive voice "A été"', () => {
    const results = analyzeWeakBullets([makeExp(['A été impliqué dans le projet'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('passive-voice');
    expect(issues).toContain('no-metrics');
  });

  it('Test 10: detects English passive voice "has been"', () => {
    const results = analyzeWeakBullets([makeExp(['The system has been updated by the team'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('passive-voice');
  });

  // ─── Too short detection ───

  it('Test 11: detects too-short bullet under 20 chars', () => {
    const results = analyzeWeakBullets([makeExp(['Aidé les clients'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('weak-verb');
    expect(issues).toContain('no-metrics');
    expect(issues).toContain('too-short');
  });

  // ─── Too vague detection ───

  it('Test 12: detects "diverses tâches" as too-vague', () => {
    const results = analyzeWeakBullets([makeExp(['Géré diverses tâches administratives'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('weak-verb');
    expect(issues).toContain('no-metrics');
    expect(issues).toContain('too-vague');
  });

  it('Test 13: detects "etc." as too-vague', () => {
    const results = analyzeWeakBullets([makeExp(['Développé des features, tests, etc.'])]);
    const issues = results[0].issues.map((i) => i.type);
    expect(issues).toContain('too-vague');
  });

  // ─── Hidden experience skipping ───

  it('Test 14: skips hidden experiences entirely', () => {
    const results = analyzeWeakBullets([
      makeExp(['Responsable de tout le département'], 'hidden'),
    ]);
    expect(results.length).toBe(0);
  });

  // ─── Empty descriptions ───

  it('Test 15: empty description array produces no results', () => {
    const results = analyzeWeakBullets([makeExp([])]);
    expect(results.length).toBe(0);
  });

  // ─── Multiple experiences with mixed results ───

  it('Test 16: handles multiple experiences with correct indices', () => {
    const results = analyzeWeakBullets([
      makeExp(['Augmenté le CA de 35% en 6 mois']),
      makeExp(['Responsable de la communication']),
    ]);
    expect(results.length).toBe(1);
    expect(results[0].expIndex).toBe(1);
    expect(results[0].bulletIndex).toBe(0);
  });

  // ─── Labels are in French ───

  it('Test 17: issue labels are in French', () => {
    const results = analyzeWeakBullets([makeExp(["Responsable de l'équipe"])]);
    const labels = results[0].issues.map((i) => i.label);
    expect(labels).toContain('Verbe faible');
    expect(labels).toContain('Aucune metrique');
  });

  // ─── Multiple bullets in one experience ───

  it('Test 18: reports correct bulletIndex for multiple bullets', () => {
    const results = analyzeWeakBullets([
      makeExp([
        'Led migration of 3 microservices reducing latency by 40%',
        'Worked on various projects',
      ]),
    ]);
    expect(results.length).toBe(1);
    expect(results[0].expIndex).toBe(0);
    expect(results[0].bulletIndex).toBe(1);
  });
});
