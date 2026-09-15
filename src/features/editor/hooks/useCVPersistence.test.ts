import { describe, it, expect } from 'vitest';
import { buildPersistedCV, appendToGuestList, replacesDraft, stripPersistenceArtifacts } from './useCVPersistence';
import type { CVData, DesignSettings } from '@/src/shared/types';

const SAMPLE_CV: CVData = {
  personal_info: { name: 'X', email: 'x@y.z' },
  experience: [],
  education: [],
  skills: [],
  languages: [],
};

const SAMPLE_DESIGN: DesignSettings = {
  template: 'TEMPLATE_C',
  primaryColor: '#000',
  secondaryColor: '#fff',
  fontFamily: 'sans',
};

describe('buildPersistedCV', () => {
  it('overrides design.template with selectedTemplate', () => {
    const out = buildPersistedCV(SAMPLE_CV, SAMPLE_DESIGN, 'TEMPLATE_E');
    expect(out.design?.template).toBe('TEMPLATE_E');
  });

  it('preserves all content fields', () => {
    const cv: CVData = {
      ...SAMPLE_CV,
      personal_info: { name: 'Jane', email: 'jane@example.com' },
      experience: [{ company: 'Acme', position: 'Dev', start_date: '2020', current: true, description: ['bullet'] }],
    };
    const out = buildPersistedCV(cv, SAMPLE_DESIGN, 'TEMPLATE_C');
    expect(out.personal_info.name).toBe('Jane');
    expect(out.experience).toHaveLength(1);
  });

  it('does not mutate inputs', () => {
    const design = { ...SAMPLE_DESIGN };
    const out = buildPersistedCV(SAMPLE_CV, design, 'TEMPLATE_E');
    expect(out).not.toBe(SAMPLE_CV);
    expect(out.design).not.toBe(design);
    expect(design.template).toBe('TEMPLATE_C'); // unchanged
  });
});

describe('stripPersistenceArtifacts', () => {
  it('drops the saved offer with the table fields, so it never rides inside the CV into a prompt', () => {
    const saved = { ...SAMPLE_CV, _id: 'cv1', _creationTime: 1, userId: 'u', createdAt: 'd', jobDescription: 'Offre A' };
    expect(stripPersistenceArtifacts(saved)).toEqual(SAMPLE_CV);
  });
});

describe('replacesDraft', () => {
  const OTHER_CV: CVData = { ...SAMPLE_CV, personal_info: { name: 'Y', email: 'y@y.z' } };

  it('asks while the draft is still loading', () => {
    expect(replacesDraft(undefined, '', SAMPLE_CV, '')).toBe(true);
  });

  it('does not ask when neither the CV nor the offer changes (table fields aside)', () => {
    expect(replacesDraft({ ...SAMPLE_CV, _id: 'cv1' } as CVData, ' Offre A\n', SAMPLE_CV, 'Offre A')).toBe(false);
    expect(replacesDraft(null, '', SAMPLE_CV, '')).toBe(false);
  });

  it('asks when only the offer differs, including an old version without offer', () => {
    expect(replacesDraft(SAMPLE_CV, 'Offre A', SAMPLE_CV, 'Offre B')).toBe(true);
    expect(replacesDraft(SAMPLE_CV, 'Offre A', SAMPLE_CV, '')).toBe(true);
  });

  it('asks when the draft holds an offer but no CV', () => {
    expect(replacesDraft(null, 'Offre A', SAMPLE_CV, '')).toBe(true);
  });

  it('asks when the CV differs', () => {
    expect(replacesDraft(SAMPLE_CV, 'Offre A', OTHER_CV, 'Offre A')).toBe(true);
  });
});

describe('appendToGuestList', () => {
  it('prepends new entry to the list', () => {
    const existing = [{ _id: 'a', createdAt: '2026-01-01' }];
    const next = { ...SAMPLE_CV, _id: 'b', createdAt: '2026-04-11' };
    const out = appendToGuestList(existing, next);
    expect(out).toHaveLength(2);
    expect((out[0] as { _id: string })._id).toBe('b');
  });

  it('returns a new array (does not mutate existing)', () => {
    const existing: unknown[] = [];
    const next = { ...SAMPLE_CV, _id: 'x', createdAt: 'y' };
    const out = appendToGuestList(existing, next);
    expect(out).not.toBe(existing);
    expect(existing).toEqual([]);
  });
});
