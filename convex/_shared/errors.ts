import { ConvexError } from "convex/values";

/**
 * The one way to throw an error a user reads.
 *
 * Convex redacts plain Error messages in production: the client only ever got
 * its generic fallback. ConvexError.data survives, and getUserErrorMessage
 * (src/shared/lib/convexError.ts) reads `userMessage` from it; `code` is a
 * stable key the client can branch on.
 *
 * Lives outside convex/_ai/chat.ts because that file runs on the Node runtime
 * and cannot be imported by queries and mutations.
 */
export function userError(userMessage: string, code: string): ConvexError<{ userMessage: string; code: string }> {
  return new ConvexError({ userMessage, code });
}

export const unauthenticated = () =>
  userError("Session expirée : reconnectez-vous pour continuer.", "UNAUTHENTICATED");

export const notAuthorized = () =>
  userError("Vous n'avez pas accès à ce document.", "NOT_AUTHORIZED");

export const userNotFound = () =>
  userError("Compte introuvable : reconnectez-vous pour continuer.", "USER_NOT_FOUND");
