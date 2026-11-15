import { describe, it, expect } from 'vitest';
import {
  buildCoverLetterText,
  letterStorageKey,
  buildFilename,
  parseStoredContext,
  isStoredContextForOffer,
  COVER_LETTER_STORAGE_KEY,
  type CoverLetterData,
} from './cover-letter-drafts';

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

  it('leads with the subject line, so a paste needs no second trip', () => {
    const out = buildCoverLetterText(SAMPLE);
    expect(out.startsWith('Objet : ')).toBe(true);
    expect(out).toContain(SAMPLE.subject);
    // ...and the subject still comes before the greeting
    expect(out.indexOf(SAMPLE.subject)).toBeLessThan(out.indexOf('Madame, Monsieur,'));
  });

  it('labels the subject in the language the letter is written in', () => {
    const english: CoverLetterData = {
      subject: 'Application for the Senior Product Designer position',
      greeting: 'Dear Hiring Manager,',
      body: 'I am writing to apply for the Senior Product Designer role at your company. Over the past ten years I have led design teams and shipped products used by millions of people.',
      closing: 'Best regards,',
    };
    expect(buildCoverLetterText(english).startsWith('Subject: ')).toBe(true);
    expect(buildCoverLetterText(SAMPLE).startsWith('Objet : ')).toBe(true);
  });

  it('omits the subject line when empty', () => {
    const out = buildCoverLetterText({ ...SAMPLE, subject: '   ' });
    expect(out).not.toContain('Objet :');
    expect(out.startsWith('Madame, Monsieur,')).toBe(true);
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



describe('parseStoredLetter', () => {
  it('parses a valid mirrored letter', () => {
    expect(parseStoredContext(JSON.stringify(SAMPLE))?.letter).toEqual(SAMPLE);
  });

  it('returns null for null/empty input', () => {
    expect(parseStoredContext(null)).toBeNull();
    expect(parseStoredContext('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseStoredContext('{not json')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseStoredContext('"a string"')).toBeNull();
    expect(parseStoredContext('42')).toBeNull();
    expect(parseStoredContext('null')).toBeNull();
  });

  it('returns null when a field is missing or not a string', () => {
    expect(parseStoredContext(JSON.stringify({ ...SAMPLE, body: undefined }))?.letter).toBeNull();
    expect(parseStoredContext(JSON.stringify({ ...SAMPLE, subject: 12 }))?.letter).toBeNull();
  });

  it('strips unknown extra fields', () => {
    const stored = JSON.stringify({ ...SAMPLE, extra: 'ignored' });
    expect(parseStoredContext(stored)?.letter).toEqual(SAMPLE);
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


describe('application identity', () => {
  it('separates accounts, CVs and offers, and ignores surrounding whitespace only', () => {
    const key = letterStorageKey('one', 'cv1', 'Offer');
    expect(letterStorageKey('one', 'cv1', ' Offer ')).toBe(key);
    expect(letterStorageKey('two', 'cv1', 'Offer')).not.toBe(key);
    expect(letterStorageKey('one', 'cv2', 'Offer')).not.toBe(key);
    expect(letterStorageKey('one', 'cv1', 'Other')).not.toBe(key);
  });
});

it('does not attach a letter without an offer to the current application automatically', () => {
  expect(isStoredContextForOffer({ letter: SAMPLE }, 'New offer')).toBe(false);
  expect(isStoredContextForOffer({ letter: SAMPLE, jobDescription: 'Offer' }, ' Offer ')).toBe(true);
});
