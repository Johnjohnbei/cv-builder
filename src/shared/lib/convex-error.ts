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

/** The stable `code` a backend ConvexError carries (e.g. "ACCESS_CODE_INVALID"), if any. */
export function getErrorCode(e: unknown): string | undefined {
  if (!(e instanceof ConvexError)) return undefined;
  const code = (e.data as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}
