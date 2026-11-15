"use node";

import { createHash } from 'node:crypto';
import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { ATS_SOURCES } from '../../src/features/editor/lib/ats-rules';
import { readTextUpTo } from './publicUrl';
import { htmlToText } from './htmlText';

/** Fixed official URLs, no redirects or third-party reader. No candidate data leaves the app. */
export const checkSources = internalAction({
  args: {},
  handler: async ctx => {
    for (const source of ATS_SOURCES) {
      try {
        const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
        if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
        const html = await readTextUpTo(response, 1_000_000);
        if (new TextEncoder().encode(html).length >= 999_990) throw new Error('Source too large');
        const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
        const text = htmlToText(article, 100_001).replace(/\s+/g, ' ').trim();
        if (text.length > 100_000) throw new Error('Source too large');
        if (text.length < 100 || /just a moment|verify you are human|access denied/i.test(text)) throw new Error('Source unavailable');
        const hash = createHash('sha256').update(text).digest('hex');
        await ctx.runMutation(internal.ats.recordSource, { sourceId: source.id, hash, text });
      } catch {
        await ctx.runMutation(internal.ats.recordSource, { sourceId: source.id, error: 'Source inaccessible ; dernière empreinte conservée.' });
      }
    }
  },
});
