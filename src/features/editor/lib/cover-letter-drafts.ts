import type { CVData } from '@/src/shared/types';
import { detectTextLanguage } from '@/src/lib/language-detection';
import { stripAccents } from '@/src/shared/lib/text';
import { readStoredText } from '@/src/shared/lib/storage';

export interface CoverLetterData { subject: string; greeting: string; body: string; closing: string }

export function getLetterLanguage(letter: CoverLetterData): 'fr' | 'en' {
  return detectTextLanguage([letter.subject, letter.greeting, letter.body, letter.closing].join('\n'));
}

/**
 * Format a cover letter into a plain-text block suitable for copy/download.
 *
 * The subject line leads, as it does in the .docx export: a letter pasted into
 * an email without its "Objet" forces the user back into the drawer to grab it
 * separately, which is the whole point of a one-click copy.
 */
export function buildCoverLetterText(
  letter: CoverLetterData,
  name?: string,
  language: 'fr' | 'en' = getLetterLanguage(letter),
): string {
  const parts: string[] = [];
  if (letter.subject?.trim()) parts.push(`${language === 'en' ? 'Subject: ' : 'Objet : '}${letter.subject.trim()}`);
  parts.push(letter.greeting, letter.body, letter.closing);
  if (name && name.trim().length > 0) parts.push(name.trim());
  return parts.join('\n\n').replace(/\s+$/, '');
}

const slug = (s: string): string =>
  stripAccents(s).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Build a download filename for the cover letter. */
export function buildFilename(companyName?: string): string {
  if (!companyName || companyName.trim().length === 0) return 'lettre-motivation.txt';
  const slugged = slug(companyName);
  return slugged.length > 0 ? `lettre-${slugged}.txt` : 'lettre-motivation.txt';
}

/** localStorage mirror of the drawer context (survives drawer close, guest or signed in). */
export const COVER_LETTER_STORAGE_KEY = 'guest_last_cover_letter';

/** Drawer context mirrored to localStorage: the letter plus the company metadata already known. */
export interface StoredCoverLetterContext {
  letter: CoverLetterData | null;
  companyName?: string;
  companyStage?: string;
  companyBusinessModel?: string;
  jobDescription?: string;
  motivation?: string;
  tone?: string;
  updatedAt?: number;
  cvSnapshot?: CVData;
  revisions?: CoverLetterData[];
}

const asText = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

function parseLetterShape(v: unknown): CoverLetterData | null {
  if (v === null || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (
    typeof p.subject === 'string' && typeof p.greeting === 'string' &&
    typeof p.body === 'string' && typeof p.closing === 'string'
  ) {
    return { subject: p.subject, greeting: p.greeting, body: p.body, closing: p.closing };
  }
  return null;
}

/**
 * Parse the mirrored drawer context. Returns null only when nothing usable is stored.
 * Backward compatible: a legacy value holding the bare letter fields at the top level is
 * read as a context whose letter is that value and whose metadata is absent.
 */
export function parseStoredContext(raw: string | null): StoredCoverLetterContext | null {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (parsed === null || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  return {
    letter: parseLetterShape(p) ?? parseLetterShape(p.letter),
    companyName: asText(p.companyName),
    companyStage: asText(p.companyStage),
    companyBusinessModel: asText(p.companyBusinessModel),
    jobDescription: asText(p.jobDescription),
    revisions: Array.isArray(p.revisions) ? p.revisions.map(parseLetterShape).filter((entry): entry is CoverLetterData => entry !== null).slice(-20) : undefined,
    motivation: asText(p.motivation), tone: asText(p.tone),
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : undefined,
    cvSnapshot: p.cvSnapshot && typeof p.cvSnapshot === "object" ? p.cvSnapshot as CVData : undefined,
  };
}

/**
 * Does a mirrored context belong to the offer currently open?
 *
 * Without its offer a legacy letter cannot be associated automatically. The
 * workspace offers an explicit import instead; it never deletes that copy.
 */
export function isStoredContextForOffer(
  stored: StoredCoverLetterContext | null,
  currentJobDescription: string,
): boolean {
  if (!stored) return false;
  if (stored.jobDescription === undefined) return false;
  return stored.jobDescription.trim() === currentJobDescription.trim();
}

/** Separate browser drafts by account, CV and the exact trimmed offer. */
export function letterStorageKey(owner: string, cvId: string | undefined, offer: string): string {
  return `calibre_letter:${JSON.stringify([owner, cvId ?? '', offer.trim()])}`;
}

export function readApplicationDraft(key: string, offer: string, allowLegacy = false): StoredCoverLetterContext | null {
  const current = parseStoredContext(readStoredText(key));
  if (current && isStoredContextForOffer(current, offer)) return current;
  const legacy = allowLegacy ? parseStoredContext(readStoredText(COVER_LETTER_STORAGE_KEY)) : null;
  return isStoredContextForOffer(legacy, offer) ? legacy : null;
}

/** Guest applications, newest first; no account draft is returned here. */
export function guestApplications(): { key: string; context: StoredCoverLetterContext }[] {
  try {
    return Object.keys(localStorage).filter(key => key.startsWith('calibre_letter:["guest",'))
      .map(key => ({ key, context: parseStoredContext(readStoredText(key)) }))
      .filter((entry): entry is { key: string; context: StoredCoverLetterContext } => Boolean(entry.context?.letter))
      .sort((a, b) => (b.context.updatedAt ?? 0) - (a.context.updatedAt ?? 0));
  } catch { return []; }
}

/** Localized long date, e.g. "7 août 2026" / "August 7, 2026", prefixed with the sender's city when known. */
export function buildLetterDateLine(language: 'fr' | 'en', location?: string, now: Date = new Date()): string {
  const date = now.toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const city = location?.trim();
  if (!city) return date;
  return language === 'en' ? `${city}, ${date}` : `${city}, le ${date}`;
}

