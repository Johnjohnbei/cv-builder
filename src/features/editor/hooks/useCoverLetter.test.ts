import { describe, it, expect } from 'vitest';
import {
  buildCoverLetterText,
  buildFilename,
  canSave,
  shouldTriggerExtraction,
  parseStoredLetter,
  parseStoredContext,
  findLatestSavedForCv,
  COVER_LETTER_STORAGE_KEY,
  type CoverLetterData,
} from './useCoverLetter';

const SAMPLE: CoverLetterData = {
  subject: 'Candidature — Dev Senior',
  greeting: 'Madame, Monsieur,',
  body: 'Premier paragraphe.\n\nDeuxième paragraphe avec détails.',
  closing: 'Cordialement,',
};

describe('buildCoverLetterText', () => {
  it('includes greeting, body, and closing separated by blank lines', () => {
    const out = buildCoverLetterText(SAMPLE);
    expect(out).toContain('Madame, Monsieur,');
    expect(out).toContain('Premier paragraphe.');
    expect(out).toContain('Cordialement,');
    expect(out).toMatch(/Madame, Monsieur,\n\n/);
    expect(out).toMatch(/\n\nCordialement,/);
  });

  it('appends the author name when provided', () => {
    const out = buildCoverLetterText(SAMPLE, 'Jean Dupont');
    expect(out.endsWith('Jean Dupont')).toBe(true);
    expect(out).toMatch(/Cordialement,\n\nJean Dupont$/);
  });

  it('omits name when undefined or whitespace-only', () => {
    expect(buildCoverLetterText(SAMPLE).endsWith('Cordialement,')).toBe(true);
    expect(buildCoverLetterText(SAMPLE, '   ').endsWith('Cordialement,')).toBe(true);
    expect(buildCoverLetterText(SAMPLE, '').endsWith('Cordialement,')).toBe(true);
  });

  it('preserves internal blank lines inside body', () => {
    const out = buildCoverLetterText(SAMPLE);
    expect(out).toContain('Premier paragraphe.\n\nDeuxième paragraphe');
  });

  it('trims trailing whitespace', () => {
    const withTrailing: CoverLetterData = { ...SAMPLE, closing: 'Cordialement,  \n\n' };
    const out = buildCoverLetterText(withTrailing);
    expect(out).not.toMatch(/\s+$/);
  });
});

describe('buildFilename', () => {
  it('returns default filename for undefined/empty/whitespace input', () => {
    expect(buildFilename()).toBe('lettre-motivation.txt');
    expect(buildFilename('')).toBe('lettre-motivation.txt');
    expect(buildFilename('   ')).toBe('lettre-motivation.txt');
  });

  it('slugifies spaces and uppercase to kebab-case', () => {
    expect(buildFilename('Google France')).toBe('lettre-google-france.txt');
    expect(buildFilename('AIRBUS DEFENCE')).toBe('lettre-airbus-defence.txt');
  });

  it('removes accents and special characters', () => {
    expect(buildFilename('Société Générale')).toBe('lettre-societe-generale.txt');
    expect(buildFilename('Crédit Agricole — SA')).toBe('lettre-credit-agricole-sa.txt');
  });

  it('strips leading and trailing dashes after slugification', () => {
    expect(buildFilename('--Acme--')).toBe('lettre-acme.txt');
    expect(buildFilename('!!!Corp!!!')).toBe('lettre-corp.txt');
  });

  it('falls back to default when input slugifies to empty string', () => {
    expect(buildFilename('!!!')).toBe('lettre-motivation.txt');
    expect(buildFilename('---')).toBe('lettre-motivation.txt');
  });
});

describe('canSave', () => {
  it('returns false when user is null/undefined', () => {
    expect(canSave(null, SAMPLE)).toBe(false);
    expect(canSave(undefined, SAMPLE)).toBe(false);
  });

  it('returns false when letter is null (even with user)', () => {
    expect(canSave({ id: 'user_123' }, null)).toBe(false);
  });

  it('returns true only when both user and letter are present', () => {
    expect(canSave({ id: 'user_123' }, SAMPLE)).toBe(true);
  });
});

describe('shouldTriggerExtraction', () => {
  it('returns false when companyName already filled', () => {
    expect(shouldTriggerExtraction('Google', 'A'.repeat(100))).toBe(false);
  });

  it('returns false when JD shorter than 50 chars', () => {
    expect(shouldTriggerExtraction('', 'short JD')).toBe(false);
  });

  it('returns false when both empty', () => {
    expect(shouldTriggerExtraction('', '')).toBe(false);
  });

  it('returns true when companyName empty and JD >= 50 chars', () => {
    expect(shouldTriggerExtraction('', 'A'.repeat(50))).toBe(true);
  });

  it('treats whitespace-only companyName as empty', () => {
    expect(shouldTriggerExtraction('   ', 'A'.repeat(100))).toBe(true);
  });

  it('treats whitespace-padded JD as trimmed for length check', () => {
    expect(shouldTriggerExtraction('', '   ' + 'A'.repeat(60) + '   ')).toBe(true);
  });

  it('returns false when JD is whitespace-only', () => {
    expect(shouldTriggerExtraction('', '     ')).toBe(false);
  });

  it('returns false when companyName has content (even with long JD)', () => {
    expect(shouldTriggerExtraction('Acme', 'A'.repeat(1000))).toBe(false);
  });
});

describe('parseStoredLetter', () => {
  it('parses a valid mirrored letter', () => {
    expect(parseStoredLetter(JSON.stringify(SAMPLE))).toEqual(SAMPLE);
  });

  it('returns null for null/empty input', () => {
    expect(parseStoredLetter(null)).toBeNull();
    expect(parseStoredLetter('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseStoredLetter('{not json')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseStoredLetter('"a string"')).toBeNull();
    expect(parseStoredLetter('42')).toBeNull();
    expect(parseStoredLetter('null')).toBeNull();
  });

  it('returns null when a field is missing or not a string', () => {
    expect(parseStoredLetter(JSON.stringify({ ...SAMPLE, body: undefined }))).toBeNull();
    expect(parseStoredLetter(JSON.stringify({ ...SAMPLE, subject: 12 }))).toBeNull();
  });

  it('strips unknown extra fields', () => {
    const stored = JSON.stringify({ ...SAMPLE, extra: 'ignored' });
    expect(parseStoredLetter(stored)).toEqual(SAMPLE);
  });

  it('uses the expected localStorage key', () => {
    expect(COVER_LETTER_STORAGE_KEY).toBe('guest_last_cover_letter');
  });
});

describe('parseStoredContext', () => {
  const CONTEXT = {
    letter: SAMPLE,
    companyName: 'Acme Corp',
    companyStage: 'Scale-up',
    companyBusinessModel: 'SaaS B2B',
    jobDescription: 'A'.repeat(80),
  };

  it('parses the full context', () => {
    expect(parseStoredContext(JSON.stringify(CONTEXT))).toEqual(CONTEXT);
  });

  it('reads a legacy bare-letter value without company metadata', () => {
    expect(parseStoredContext(JSON.stringify(SAMPLE))).toEqual({
      letter: SAMPLE,
      companyName: undefined,
      companyStage: undefined,
      companyBusinessModel: undefined,
      jobDescription: undefined,
    });
  });

  it('accepts a context without any letter (company seeded alone)', () => {
    const ctx = parseStoredContext(JSON.stringify({ companyName: 'Acme Corp' }));
    expect(ctx?.letter).toBeNull();
    expect(ctx?.companyName).toBe('Acme Corp');
  });

  it('ignores metadata that is missing, empty or not a string', () => {
    const ctx = parseStoredContext(JSON.stringify({
      letter: SAMPLE, companyName: '', companyStage: 42, companyBusinessModel: null,
    }));
    expect(ctx).toEqual({
      letter: SAMPLE,
      companyName: undefined,
      companyStage: undefined,
      companyBusinessModel: undefined,
      jobDescription: undefined,
    });
  });

  it('keeps the metadata when the nested letter is malformed', () => {
    const ctx = parseStoredContext(JSON.stringify({ letter: { subject: 12 }, companyName: 'Acme' }));
    expect(ctx?.letter).toBeNull();
    expect(ctx?.companyName).toBe('Acme');
  });

  it('returns null for null/empty/malformed/non-object input', () => {
    expect(parseStoredContext(null)).toBeNull();
    expect(parseStoredContext('')).toBeNull();
    expect(parseStoredContext('{not json')).toBeNull();
    expect(parseStoredContext('"a string"')).toBeNull();
    expect(parseStoredContext('null')).toBeNull();
  });
});

describe('findLatestSavedForCv', () => {
  const letters = [
    { cvId: 'cv2', subject: 'newest cv2' },
    { cvId: 'cv1', subject: 'newest cv1' },
    { cvId: 'cv1', subject: 'older cv1' },
    { subject: 'no cvId' },
  ];

  it('returns the first (most recent) letter matching the cvId', () => {
    expect(findLatestSavedForCv(letters, 'cv1')?.subject).toBe('newest cv1');
    expect(findLatestSavedForCv(letters, 'cv2')?.subject).toBe('newest cv2');
  });

  it('returns null when no letter matches', () => {
    expect(findLatestSavedForCv(letters, 'cv999')).toBeNull();
  });

  it('returns null when cvId is undefined (never matches letters without cvId)', () => {
    expect(findLatestSavedForCv(letters, undefined)).toBeNull();
  });

  it('returns null when list is undefined or empty', () => {
    expect(findLatestSavedForCv(undefined, 'cv1')).toBeNull();
    expect(findLatestSavedForCv([], 'cv1')).toBeNull();
  });
});
