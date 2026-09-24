#!/usr/bin/env node
/**
 * file-naming scan: a file name says what the file does (rule: ~/.claude/CLAUDE.md « fichiers lisibles par leur nom »).
 * Shared by every repo. Reads `.file-naming.json` in the current directory:
 *   {
 *     "ignore": ["vendor/"],                 path prefixes left out (vendored, generated, archived)
 *     "pascalDirs": ["src/services/"],       where a PascalCase .ts module (a class) is allowed
 *     "testDirs": ["__tests__/", "e2e/"],    tests must live under one of these; [] = next to the file
 *     "suffixes": ["types", "test"],         closed list of dotted role suffixes (x.types.ts)
 *     "exceptions": { "<path>": "<reason>" } one line per justified exception
 *   }
 * Rules: generic word in the name · .tsx not a PascalCase component or useX hook · non-component module
 * not kebab-case · hook not useX · non-hook under hooks/ · test outside testDirs · dotted suffix off the list ·
 * re-export-only shim (index files excepted).
 *
 * Run:    node ~/.claude/skills/file-naming/scan.mjs            (exit 1 on any violation)
 * Report: node ~/.claude/skills/file-naming/scan.mjs --list     (all violations, never fails)
 * Test:   node ~/.claude/skills/file-naming/scan.mjs --selftest
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { basename, dirname } from 'node:path';

const CODE = /\.(tsx?|jsx?|mjs|cjs)$/;
// Words that say nothing about the role, or say something false once the migration is over.
const GENERIC = new Set(['helper', 'helpers', 'util', 'utils', 'utilities', 'misc', 'common', 'stuff', 'new', 'unified',
  'optimized', 'enhanced', 'improved', 'simplified', 'legacy', 'old', 'temp', 'tmp', 'final', 'migrated', 'impl']);
const ALWAYS_IGNORED = /(^|\/)(node_modules|dist|build|coverage|storybook-static|graphify-out)\//;

const stripExt = (b) => b.replace(CODE, '');
const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s._-]+/).filter(Boolean).map((w) => w.toLowerCase());
const isPascal = (s) => /^[A-Z][A-Za-z0-9]*$/.test(s);
const isKebab = (s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
const isHook = (s) => /^use[A-Z][A-Za-z0-9]*$/.test(s);
const isTest = (f) => /\.(test|spec)\.[a-z]+$/.test(f);
const isStory = (f) => /\.stories\.[a-z]+$/.test(f);

/** Violations of one file. `siblings` = base names (no extension) present in the same directory. */
export function checkFile(file, cfg, siblings = new Set(), text = '') {
  const out = [];
  const name = stripExt(basename(file)).replace(/\.(test|spec|stories)$/, '');
  // `_x` (private to a routed folder, e.g. Vercel api/) and `[param]` (dynamic route) are routing syntax, not style.
  if (/^\[\.{0,3}[A-Za-z]+\]$/.test(name)) return out;
  const [stem, ...parts] = name.replace(/^_/, '').split('.');
  const bad = words(name).filter((w) => GENERIC.has(w) || /^v\d+$/.test(w));
  if (bad.length) out.push(`generic word « ${bad.join(', ')} »`);

  const suffix = parts.join('.');
  // A PascalCase part (ArkTable.Row.tsx) is a subcomponent of its sibling parent, not a role suffix.
  const partOfParent = parts.length && parts.every(isPascal) && siblings.has(stem);
  if (suffix && !isTest(file) && !partOfParent && !cfg.suffixes.includes(suffix)) out.push(`suffix « .${suffix} » not in the closed list`);

  const inHooks = /(^|\/)hooks\//.test(file) && !/^scripts\//.test(file);
  // A test mirrors its subject's name: only its place and its words are checked.
  if (isTest(file)) { /* style follows the subject */ }
  else if (/^use[-_]/.test(stem)) out.push('hook not named useX');
  else if (file.endsWith('.tsx')) {
    // kebab-case .tsx is a module that carries JSX (nav tables, icon maps) but exports no component.
    const exportsComponent = /^export\s+(default\s+)?(function|const|class)\s+[A-Z][a-z]/m.test(text);
    if (stem !== 'index' && !isPascal(stem) && !isHook(stem) && (exportsComponent || !isKebab(stem))) out.push('.tsx component not PascalCase');
  } else if (!isHook(stem) && !(cfg.moduleCase === 'camel' ? /^[a-z][A-Za-z0-9]*$/.test(stem) : isKebab(stem))) {
    const pascalOk = isPascal(stem) && (cfg.pascalDirs.some((d) => file.startsWith(d)) || siblings.has(stem) && parts.length);
    if (!pascalOk) out.push(`module not ${cfg.moduleCase === 'camel' ? 'camelCase' : 'kebab-case'}`);
  }
  if (inHooks && !isTest(file) && !/^use/.test(stem) && stem !== 'index') out.push('non-hook under hooks/');

  if (isTest(file) && cfg.testDirs.length && !cfg.testDirs.some((d) => file.startsWith(d) || file.includes(`/${d}`))) {
    out.push(`test outside ${cfg.testDirs.join(' | ')}`);
  }
  if (cfg.testDirs.length === 0 && isTest(file) && file.includes('/__tests__/')) out.push('test not next to its file');

  const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').trim();
  if (stem !== 'index' && code && code.split(/;?\s*\n/).every((l) => !l.trim() || /^export\s.*\sfrom\s/.test(l.trim()))) {
    out.push('re-export-only shim: import the owner directly');
  }
  return out;
}

// Tracked files; a CI checkout without .git falls back to a walk of the tree.
function listFiles() {
  try { return execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n'); } catch {
    const out = [];
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = d === '.' ? e.name : `${d}/${e.name}`;
      if (e.isDirectory()) walk(p); else out.push(p);
    } };
    walk('.');
    return out;
  }
}

function load() {
  const cfg = { ignore: [], pascalDirs: [], testDirs: [], suffixes: [], exceptions: {}, ...JSON.parse(readFileSync('.file-naming.json', 'utf8')) };
  const files = listFiles()
    .filter((f) => CODE.test(f) && !/\.d\.ts$/.test(f) && !ALWAYS_IGNORED.test(f) && !cfg.ignore.some((p) => f.startsWith(p)) && existsSync(f));
  return { cfg, files };
}

function scan() {
  const { cfg, files } = load();
  const byDir = new Map();
  for (const f of files) {
    const d = dirname(f);
    if (!byDir.has(d)) byDir.set(d, new Set());
    byDir.get(d).add(stripExt(basename(f)).split('.')[0]);
  }
  const found = [];
  for (const f of files) {
    if (cfg.exceptions[f] || isStory(f)) continue;
    const text = readFileSync(f, 'utf8');
    // `overrides`: a folder with its own platform rule (e.g. Convex module names cannot hold a hyphen).
    const zone = Object.entries(cfg.overrides || {}).find(([p]) => f.startsWith(p));
    const fcfg = zone ? { ...cfg, ...zone[1] } : cfg;
    for (const v of checkFile(f, fcfg, byDir.get(dirname(f)), text)) found.push(`${f}: ${v}`);
  }
  const stale = Object.keys(cfg.exceptions).filter((f) => !files.includes(f));
  for (const f of stale) found.push(`${f}: exception for a file that no longer exists`);
  return found;
}

function selftest() {
  const cfg = { pascalDirs: ['src/services/'], testDirs: ['__tests__/'], suffixes: ['types'], exceptions: {} };
  const t = (f, n, sib = [], text = 'export const a = 1;') => {
    const got = checkFile(f, cfg, new Set(sib), text).length;
    if (got !== n) throw new Error(`${f}: expected ${n} violation(s), got ${got}`);
  };
  t('src/utils/dateTimeUtils.ts', 2); // generic + camelCase
  t('src/lib/date-time.ts', 0);
  t('src/services/EventService.ts', 0);
  t('src/types/EventData.ts', 1);
  t('src/components/Card.tsx', 0);
  t('src/components/card-list.tsx', 1, [], 'export function CardList() {}');
  t('src/constants/event-play-nav.tsx', 0, [], 'export const EVENT_PLAY_NAV = [];');
  t('render/routes/generate-v2.ts', 1);
  t('src/hooks/use-toast.ts', 1);
  t('src/hooks/useToast.ts', 0);
  t('src/hooks/cascade-data.ts', 1);
  t('src/x/Foo.test.ts', 1);
  t('src/x/__tests__/Foo.test.ts', 0);
  t('src/ArkTable.Row.tsx', 0, ['ArkTable']);
  t('src/ArkDialog.types.ts', 0, ['ArkDialog']);
  t('src/Ark.helpers.ts', 2, ['Ark']);
  t('src/lib/shim.ts', 1, [], "// shim\nexport * from '@x/y';");
  t('src/lib/index.ts', 0, [], "export * from './a';");
  t('src/pages/DashboardNew.tsx', 1);
  t('src/components/NewsletterForm.tsx', 0);
  t('api/newsletter/_lib/_styles.ts', 0);
  t('api/og/[type]/[slug].tsx', 0);
  t('api/_lib/_badName.ts', 1);
  const camel = { ...cfg, moduleCase: 'camel', testDirs: ['__tests__/'] };
  if (checkFile('convex/accessCodes.ts', camel).length) throw new Error('camel zone');
  if (!checkFile('convex/access-codes.ts', camel).length) throw new Error('camel zone rejects kebab');
  console.log('file-naming selftest: ok');
}

const arg = process.argv[2];
if (arg === '--selftest') selftest();
else {
  const found = scan();
  found.forEach((l) => console.log(l));
  console.log(`file-naming: ${found.length} violation(s)`);
  if (found.length && arg !== '--list') process.exit(1);
}
