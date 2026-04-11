import { describe, it, expect } from 'vitest';
import { buildCoverLetterText, buildFilename, canSave, type CoverLetterData } from './useCoverLetter';

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
