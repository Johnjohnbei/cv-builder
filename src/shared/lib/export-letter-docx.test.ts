import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import type { Document } from 'docx';
// ponytail: jszip is a transitive dep of docx (test-only use), avoids adding a dependency
import JSZip from 'jszip';
import type { PersonalInfo } from '../types';
import { buildLetterDocument, buildLetterFilename, buildLetterDateLine } from './export-letter-docx';

async function toXml(doc: Document): Promise<string> {
  const buffer = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('word/document.xml')!.async('string');
}

const personalInfo: PersonalInfo = {
  name: 'Jean Dupont',
  email: 'jean@example.com',
  phone: '0600000000',
  location: 'Paris',
};

const letter = {
  subject: 'Candidature Product Manager',
  greeting: 'Madame, Monsieur,',
  body: 'Premier paragraphe de la lettre.\n\nDeuxième paragraphe avec détails.',
  closing: 'Je vous prie d\'agréer mes salutations distinguées.',
};

describe('buildLetterFilename', () => {
  it('slugifies the company name and strips accents (FR)', () => {
    expect(buildLetterFilename('Société Générale')).toBe('Lettre_Societe_Generale.docx');
  });

  it('uses the EN prefix in English', () => {
    expect(buildLetterFilename('Acme & Co', 'en')).toBe('Cover_Letter_Acme_Co.docx');
  });

  it('falls back to a bare prefix without company', () => {
    expect(buildLetterFilename(undefined)).toBe('Lettre.docx');
    expect(buildLetterFilename('   ', 'en')).toBe('Cover_Letter.docx');
  });
});

describe('buildLetterDateLine', () => {
  const date = new Date(2026, 7, 7); // 7 August 2026

  it('formats FR with city prefix', () => {
    expect(buildLetterDateLine('fr', 'Paris', date)).toBe('Paris, le 7 août 2026');
  });

  it('formats EN with city prefix', () => {
    expect(buildLetterDateLine('en', 'Paris', date)).toBe('Paris, August 7, 2026');
  });

  it('omits the city when unknown', () => {
    expect(buildLetterDateLine('fr', undefined, date)).toBe('7 août 2026');
  });
});

describe('buildLetterDocument', () => {
  it('contains sender info, subject, greeting, body paragraphs, closing and signature', async () => {
    const xml = await toXml(buildLetterDocument({ letter, personalInfo, language: 'fr' }));
    expect(xml).toContain('Jean Dupont');
    expect(xml).toContain('jean@example.com');
    expect(xml).toContain('Objet : Candidature Product Manager');
    expect(xml).toContain('Madame, Monsieur,');
    expect(xml).toContain('Premier paragraphe de la lettre.');
    expect(xml).toContain('Deuxième paragraphe avec détails.');
    expect(xml).toContain('salutations distinguées');
  });

  it('uses the EN subject label', async () => {
    const xml = await toXml(buildLetterDocument({
      letter: { ...letter, subject: 'Application: Product Manager' },
      personalInfo,
      language: 'en',
    }));
    expect(xml).toContain('Subject: Application: Product Manager');
  });

  it('generates without throwing when subject is empty', async () => {
    const xml = await toXml(buildLetterDocument({
      letter: { ...letter, subject: '' },
      personalInfo,
    }));
    expect(xml).not.toContain('Objet :');
  });
});
