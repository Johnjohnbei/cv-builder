import { ConvexError } from 'convex/values';

/**
 * Extract the user-facing French message carried by a backend ConvexError
 * (`data.userMessage`, set in convex/_ai/chat.ts and convex/ai.ts).
 * Plain Errors are redacted by Convex in prod, so anything else gets the fallback.
 */
export function getUserErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ConvexError) {
    const msg = (e.data as { userMessage?: unknown } | null | undefined)?.userMessage;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return fallback;
}

/**
 * Shown when a write to the account failed: the work is on screen but not kept,
 * and reloading the editor loses it. Said whenever a paid result (a tailoring,
 * a translation, a letter) was only warned about in the console.
 */
export const PERSIST_FAILED_MESSAGE =
  "Enregistrement impossible sur votre compte : ce qui est à l'écran n'est pas gardé. Vérifiez votre connexion, puis réessayez avant de quitter la page.";

/** The stable `code` a backend ConvexError carries (e.g. "ACCESS_CODE_INVALID"), if any. */
export function getErrorCode(e: unknown): string | undefined {
  if (!(e instanceof ConvexError)) return undefined;
  const code = (e.data as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}
