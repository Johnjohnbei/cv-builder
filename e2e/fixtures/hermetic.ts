import { expect, type Page } from '@playwright/test';

/**
 * Keeping the e2e suite off the AI providers.
 *
 * Every Convex action is a paid LLM call. A test suite that fires them is
 * slow, flaky (it depends on a third party being up) and billed on every run —
 * measured on 2026-08-16, the suite alone accounted for ~270 of the 274
 * `extractJobKeywords` calls (now extractJobRequirements) of the whole retained log window.
 *
 * Two halves, and both are needed:
 *  - seedGuestSession() pre-fills the caches the app reads BEFORE deciding to
 *    call an action, so no call is ever triggered;
 *  - watchAICalls() proves it, by failing the test if one escapes anyway.
 *
 * The proof half matters most: without it, a new hook that calls an action on
 * mount would silently start billing and nothing would go red.
 */

/** localStorage key owned by src/features/editor/lib/job-requirements-cache.ts */
export const REQUIREMENTS_CACHE_KEY = 'job_requirements_cache_v2';

/**
 * Requirement labels a real extraction would plausibly return for the mock
 * offers. Some are present in the mock CVs and some are not, so the ATS panel
 * renders both covered and missing requirements, deterministically, which the
 * LLM never did.
 */
export const MOCK_REQUIREMENT_LABELS = [
  'Product Design', 'UX Design', 'UI Design', 'Figma', 'Design System',
  'Storybook', 'SaaS', 'B2B', 'KPI', 'NPS', 'Retention', 'Agile',
  'Design Thinking', 'Recherche utilisateur', 'Roadmap', 'Prototypage',
  'Accessibilité', 'Design Ops', 'Data', 'Shape Up',
];

/** Requirements as extractJobRequirements returns them, one per label */
export function requirementsOf(labels: string[]) {
  return labels.map(label => ({
    id: label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-'), label, variants: [], kind: 'hard_skill', importance: 'required', quote: label,
  }));
}

export interface SeedOptions {
  cv: unknown;
  /** Job description; omit for the "no offer" cases */
  jd?: string;
  /** Requirement labels to serve from cache instead of calling the LLM */
  requirementLabels?: string[];
  /** Pre-seeded cover letter context, so no company extraction fires */
  coverLetter?: { companyName: string; jobDescription: string };
}

/**
 * Put the app in guest mode with a CV, an offer, and every AI-avoiding cache
 * already warm. Navigates to /editor and waits for it to settle.
 */
export async function seedGuestSession(page: Page, opts: SeedOptions): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ cv, jd, requirements, coverLetter, cacheKey }) => {
      sessionStorage.setItem('guest_access', 'true');
      localStorage.setItem('guest_last_optimized', JSON.stringify(cv));
      if (jd) {
        localStorage.setItem('guest_last_jd', jd);
        // Warm the requirements cache for THIS exact offer: the cache compares
        // the trimmed job description, so it must match byte for byte.
        localStorage.setItem(cacheKey, JSON.stringify([{ jobDescription: jd, requirements }]));
      } else {
        localStorage.removeItem('guest_last_jd');
      }
      if (coverLetter) {
        localStorage.setItem('guest_last_cover_letter', JSON.stringify(coverLetter));
      }
    },
    {
      cv: opts.cv,
      jd: opts.jd,
      requirements: requirementsOf(opts.requirementLabels ?? MOCK_REQUIREMENT_LABELS),
      coverLetter: opts.coverLetter,
      cacheKey: REQUIREMENTS_CACHE_KEY,
    },
  );
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
}

/**
 * Record every Convex AI action the page sends.
 *
 * Actions travel over the Convex WebSocket, which `page.route` cannot
 * intercept — listening to sent frames is the only way to see them. Call
 * before navigating, assert with expectNoAICalls in afterEach.
 */
export function watchAICalls(page: Page): string[] {
  const calls: string[] = [];
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => {
      if (typeof frame.payload !== 'string') return;
      // Convex names actions "ai:<action>" in the frame payload.
      const match = frame.payload.match(/"ai:([a-zA-Z]+)"/);
      if (match) calls.push(match[1]);
    });
  });
  return calls;
}

export interface RoutedAICalls {
  /** Actions answered here, in the order the page sent them */
  answered: string[];
  /** Actions that went through to the deployment: every one of them is billed */
  forwarded: string[];
}

/**
 * Answer AI actions in place of the server, so a flow that ends in a paid call
 * (a proof, a tailoring) is tested without one. Convex sends actions over its
 * WebSocket, which page.route cannot see: the socket is routed instead, the
 * named actions answered here, every other message passed through. Call before
 * the first navigation.
 *
 * A routed socket is invisible to watchAICalls (Playwright answers it in
 * place of the browser, so no frame is ever "sent"): the returned lists are
 * what a test asserts on instead, `forwarded` being the one that must stay empty.
 */
export async function answerAIActions(page: Page, answers: Record<string, (args: any) => unknown>): Promise<RoutedAICalls> {
  const calls: RoutedAICalls = { answered: [], forwarded: [] };
  await page.routeWebSocket(/convex\.cloud/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      const sent = typeof message === 'string' ? JSON.parse(message) : null;
      const action = sent?.type === 'Action' ? String(sent.udfPath).replace(/^ai:/, '') : undefined;
      const answer = action === undefined ? undefined : answers[action];
      if (!answer) {
        if (action !== undefined) calls.forwarded.push(action);
        server.send(message);
        return;
      }
      calls.answered.push(action!);
      let response;
      try {
        response = { success: true, result: answer(sent.args[0]) };
      } catch (error) {
        response = { success: false, result: (error as Error).message };
      }
      ws.send(JSON.stringify({ type: 'ActionResponse', requestId: sent.requestId, logLines: [], ...response }));
    });
    server.onMessage((message) => ws.send(message));
  });
  return calls;
}

/** Fail the test if any paid AI call escaped. */
export function expectNoAICalls(calls: string[]): void {
  expect(calls, `aucun appel IA ne doit partir en test (reçu : ${calls.join(', ')})`).toEqual([]);
}
