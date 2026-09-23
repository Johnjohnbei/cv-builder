#!/usr/bin/env node
/**
 * anti-vibe scan: static ratchet on the code tells that make a site look "vibe coded".
 * Shared by every repo (rule: ~/.claude/CLAUDE.md « Jamais l'air d'un site vibecodé »).
 *
 * Reads `.anti-vibe.json` in the current directory:
 *   { "roots": ["src"], "ignore": ["src/legacy/"], "disable": ["emdash"], "baseline": { "<file>": { "<rule>": n } } }
 * A (file, rule) count above its baseline fails. Counts may only go down.
 * A line carrying `anti-vibe-ok: <reason>` is skipped. Comments (line and block) are stripped.
 *
 * Run:    node ~/.claude/skills/anti-vibe/scan.mjs
 * Lower:  node ~/.claude/skills/anti-vibe/scan.mjs --update   (first run writes the baseline, later runs only lower it)
 * Test:   node ~/.claude/skills/anti-vibe/scan.mjs --selftest
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export const RULES = {
  gradient: /\bbg-(?:gradient-to|linear|radial|conic)-|\b(?:linear|radial|conic)-gradient\(/,
  'gradient-text': /\bbg-clip-text\b|background-clip:\s*text/,
  glow: /\b(?:drop-)?shadow-\[0_0_|box-shadow:\s*0\s+0\s+\d{2,}px|[\w-]-glow\b|\bglow-[\w-]/,
  glass: /\bbackdrop-blur|backdrop-filter:\s*blur/,
  'side-stripe': /\bborder-[lr]-(?:[2-8]\b|\[\d)/,
  motion: /\banimate-(?:bounce|ping|marquee)\b|<marquee/,
  scroll: /\blenis\b|locomotive-scroll|\buseScroll\(|\b(?:min-)?h-\[(?:1[5-9]\d|[2-9]\d{2}|\d{4,})(?:s|d|l)?vh\]/i, // one screen (100dvh) is fine, stacked screens are not
  emoji: /\p{Emoji_Presentation}|\p{Extended_Pictographic}\u{fe0f}/u,
  // Training-data default faces (impeccable reflex-reject list, read 2026-09-23).
  font: /['"]Inter['"]|\bfont-inter\b|family=Inter\b|Space[+ ](?:Grotesk|Mono)|Instrument[+ ](?:Serif|Sans)|IBM[+ ]Plex|\bFraunces\b|\bNewsreader\b|['"+=]Lora\b|\bCrimson\b|Playfair|Cormorant|['"+=]Syne\b|DM[+ ](?:Sans|Serif)|['"+=]Outfit\b|Plus[+ ]Jakarta/,
  copy: /supercharg|seamless|world[- ]class|game[- ]chang|next[- ]level|unleash|revolutioni[sz]|effortless|cutting[- ]edge|unlock your|révolutionn(?:aire|er|ez)|sans (?:aucun )?effort|\bboost(?:ez|e ton|e votre)\b|\bpropulse[zr]?\b|libère[zr]? (?:ton|votre)|l['’]avenir d[eu]|nouvelle ère|sans couture/i,
  emdash: /—|\p{L}\s?–\s?\p{L}/u,
};
// A pill is a rounded-full that carries horizontal text padding (avatars and dots do not).
const PILL = { test: (l) => /\brounded-full\b/.test(l) && /\bpx-(?:[2-9]\b|1\d\b|\[)/.test(l) };
RULES.pill = PILL;

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.scss', '.html', '.vue', '.svelte', '.astro', '.mdx']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', 'storybook-static', '.next', '.vercel']);
// Comments never reach a visitor: strip them, block comments spanning lines included.
// ponytail: regex-level, a `//` inside a string ("https://…") also cuts the rest of the line (fewer hits, never more).
function stripComments(lines) {
  let close = null; // the closer of the open block comment: '*/' or '-->'
  return lines.map((raw) => {
    let l = raw;
    if (close) {
      const end = l.indexOf(close);
      if (end < 0) return '';
      l = l.slice(end + close.length); close = null;
    }
    l = l.replace(/\/\*.*?\*\/|<!--.*?-->/g, '');
    const open = l.search(/\/\*|<!--/);
    if (open >= 0) { close = l.startsWith('/*', open) ? '*/' : '-->'; l = l.slice(0, open); }
    return l.replace(/(^|[^:])\/\/.*$/, '$1').replace(/^\s*\*.*$/, '');
  });
}
// Log lines never reach a visitor: their emoji are not a UI tell.
const isLog = (l) => /\b(?:console|logger|log)\.\w+\(/.test(l);
const isTest = (f) => /\.(?:test|spec)\.[jt]sx?$/.test(f);

export function scanText(text, disabled = new Set()) {
  const counts = {}; const hits = [];
  const rawLines = text.split(/\r?\n/); // CRLF: `.` never crosses a \r, so comment stripping needs it gone
  stripComments(rawLines).forEach((line, i) => {
    if (!line.trim() || rawLines[i].includes('anti-vibe-ok')) return;
    for (const [id, re] of Object.entries(RULES)) {
      if (disabled.has(id) || !re.test(line) || (id === 'emoji' && isLog(line))) continue;
      counts[id] = (counts[id] ?? 0) + 1;
      hits.push({ id, line: i + 1, text: rawLines[i].trim().slice(0, 140) });
    }
  });
  return { counts, hits };
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIR.has(name)) walk(p, out); }
    else if (EXT.has(extname(name)) && !isTest(name)) out.push(p);
  }
  return out;
}

function selftest() {
  const t = (s, id, want) => {
    const got = id in scanText(s).counts;
    if (got !== want) throw new Error(`selftest: ${id} on ${JSON.stringify(s)} expected ${want}`);
  };
  t('<a className="bg-gradient-to-r from-violet-500 to-blue-500">', 'gradient', true);
  t('<h1 className="bg-clip-text text-transparent">', 'gradient-text', true);
  t('<button className="rounded-full px-4 py-2">', 'pill', true);
  t('<img className="h-10 w-10 rounded-full">', 'pill', false);
  t('<span className="rounded-full h-2 w-2 bg-success">', 'pill', false);
  t('<div className="border-l-4 border-primary">', 'side-stripe', true);
  t('<div className="border-l border-border">', 'side-stripe', false);
  t('<li>🚀 Rapide</li>', 'emoji', true);
  t('// ⛔ never do this', 'emoji', false);
  t('{/* note\n   ⛔ still a comment */}', 'emoji', false);
  t('<!-- note\n  over two lines -->\n<a class="rounded-full px-4">', 'pill', true); // an HTML comment closes on -->, not */
  t('const a = 1; // ✅ trailing note', 'emoji', false);
  t('  // ⛔ windows line\r\nx', 'emoji', false);
  t('<a href="https://x.fr">🚀</a>', 'emoji', true);
  t("console.error('❌ save failed', e);", 'emoji', false);
  t('<p>© 2026 Arkanes</p>', 'emoji', false);
  t('<p>Boostez votre productivité</p>', 'copy', true);
  t('--font-sans: "IBM Plex Sans", sans-serif;', 'font', true);
  t('family=Schibsted+Grotesk:wght@400', 'font', false);
  t('<p>Une soirée — sans script</p>', 'emdash', true);
  t('<p>20–30 joueurs</p>', 'emdash', false);
  t('<div className="h-[200vh]">', 'scroll', true);
  t('<section className="h-[100dvh]">', 'scroll', false);
  t('<div className="backdrop-blur-md"> {/* anti-vibe-ok: sheet overlay */}', 'glass', false);
  t('<div className="shadow-[0_0_40px_rgba(124,58,237,.6)]">', 'glow', true);
  console.log('anti-vibe selftest: ok');
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--selftest')) return selftest();
  const cfgPath = join(process.cwd(), '.anti-vibe.json');
  if (!existsSync(cfgPath)) { console.error('anti-vibe: no .anti-vibe.json in', process.cwd()); process.exit(2); }
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const disabled = new Set(cfg.disable ?? []);
  const ignore = cfg.ignore ?? [];
  const files = cfg.roots.flatMap((r) => (!existsSync(r) ? [] : statSync(r).isDirectory() ? walk(r, []) : [r]))
    .map((f) => relative(process.cwd(), f).replaceAll('\\', '/'))
    .filter((f) => !ignore.some((i) => f.startsWith(i)));

  const current = {}; const totals = {}; const fails = [];
  const base = cfg.baseline;
  for (const f of files) {
    const { counts, hits } = scanText(readFileSync(f, 'utf8'), disabled);
    if (!Object.keys(counts).length) continue;
    current[f] = counts;
    for (const [id, n] of Object.entries(counts)) {
      totals[id] = (totals[id] ?? 0) + n;
      const allowed = base?.[f]?.[id] ?? 0;
      if (base && n > allowed) fails.push(...hits.filter((h) => h.id === id).map((h) => `${f}:${h.line} [${id}] ${n}>${allowed}  ${h.text}`));
    }
  }

  if (args.has('--update')) {
    const next = {};
    for (const [f, counts] of Object.entries(current)) for (const [id, n] of Object.entries(counts)) {
      const v = base ? Math.min(n, base[f]?.[id] ?? 0) : n;
      if (v > 0) (next[f] ??= {})[id] = v;
    }
    writeFileSync(cfgPath, JSON.stringify({ ...cfg, baseline: next }, null, 2) + '\n');
    console.log(`anti-vibe: baseline ${base ? 'lowered' : 'written'} (${Object.keys(next).length} files)`);
  }
  console.log('anti-vibe totals:', Object.entries(totals).map(([k, v]) => `${k}=${v}`).join(' ') || 'clean');
  if (fails.length && !args.has('--update')) {
    console.error(`\nanti-vibe: ${fails.length} line(s) in counts above baseline. Remove the tell, or justify it with \`anti-vibe-ok: <reason>\`.\n`);
    console.error(fails.join('\n'));
    process.exit(1);
  }
}

main();
