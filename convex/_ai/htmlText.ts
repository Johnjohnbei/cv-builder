// ─── Readable text of an offer page ─────────────────────────────────
// Extracted from publicUrl.ts, over its size limit: fetching stays there, this
// file only reads the HTML it fetched. Every scanner is linear: a hostile page
// must not hold the action, and no deadline stops CPU work.

/** Page text handed to the model */
export const MAX_PAGE_TEXT_CHARS = 15_000;

/** Index of the ">" ending the tag whose name starts at `from`, or -1 when the page ends first */
function tagEnd(html: string, from: number): number {
  // Like a browser tokenizer, a quote opens a value only right after "=":
  // an apostrophe in a name or an unquoted value (class=l'offre) is a letter
  let state: "name" | "afterEquals" | "unquoted" | '"' | "'" = "name";
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    const space = ch === " " || ch === "\n" || ch === "\t" || ch === "\r" || ch === "\f";
    if (state === '"' || state === "'") {
      if (ch === state) state = "name";
    } else if (ch === ">") {
      return i;
    } else if (state === "afterEquals") {
      if (!space) state = ch === '"' || ch === "'" ? ch : "unquoted";
    } else if (space) {
      state = "name";
    } else if (state === "name" && ch === "=") {
      state = "afterEquals";
    }
  }
  return -1;
}

const SCRIPT_TOKENS = /<!--|-->|<(\/?)script(?=[\s/>])/gi;
// noscript is kept: the page is fetched without JavaScript, and a single-page
// app may put its only copy of the offer there
const RAW_TEXT_END = { style: /<\/style(?=[\s/>])/gi };
type RawTextElement = "script" | keyof typeof RAW_TEXT_END;
const isRawText = (name: string): name is RawTextElement => name === "script" || name === "style";

/**
 * Index of the end tag of the raw text that starts at `from`, -1 when the
 * page ends first. A script keeps a browser's escape states: a "<script>"
 * written inside "<!-- -->" opens a nested one, whose end tag does not end it.
 */
function rawTextEnd(html: string, name: RawTextElement, from: number): number {
  if (name !== "script") {
    const end = RAW_TEXT_END[name];
    end.lastIndex = from;
    return end.exec(html)?.index ?? -1;
  }
  let escaped = false;
  let nested = false;
  SCRIPT_TOKENS.lastIndex = from;
  for (let token = SCRIPT_TOKENS.exec(html); token; token = SCRIPT_TOKENS.exec(html)) {
    if (token[0] === "<!--") escaped = true;
    else if (token[0] === "-->") escaped = nested = false;
    else if (!token[1]) nested ||= escaped;
    else if (nested) nested = false;
    else return token.index;
  }
  return -1;
}

const PAGE_CHROME = new Set(["nav", "header", "footer"]);
/** Inside these, a header or footer belongs to the content (an offer's title), not to the page */
const CONTENT = new Set(["article", "main"]);

/**
 * Text of the page without its markup, scripts, styles, comments and page
 * chrome, read in one pass the way a browser tokenizes. Separate passes
 * disagreed on what was markup ("<!--" inside an attribute, "<script>" inside
 * a comment) and lost the rest of the page.
 *
 * A page cut by the byte limit ends like in a browser: an unclosed script or
 * style, comment or tag runs to the end; an unclosed nav keeps its text.
 */
function stripMarkup(html: string): string {
  const parts: string[] = [];
  // Open chrome elements per name: an end tag closes its own element only, in
  // constant time (a stack searched at every end tag went quadratic)
  const chromeOpen: Record<string, number> = { nav: 0, header: 0, footer: 0 };
  let chromeTotal = 0;
  let chromeStart = 0; // parts dropped when the last open one closes
  let contentDepth = 0;
  let i = 0; // start of the text not yet copied
  for (let lt = html.indexOf("<"); lt !== -1; lt = html.indexOf("<", Math.max(i, lt + 1))) {
    const next = html[lt + 1] ?? "";
    const closing = next === "/";
    const nameStart = closing ? lt + 2 : lt + 1;
    const comment = html.startsWith("<!--", lt);
    const tag = !comment && /[A-Za-z]/.test(html[nameStart] ?? "");
    // "<!doctype", "<?xml", "</ x": bogus comments, up to the first ">"
    const bogus = !comment && !tag && (next === "!" || next === "?" || (closing && nameStart < html.length));
    if (!comment && !tag && !bogus) continue; // "a < b" in running text
    parts.push(html.slice(i, lt));
    // From lt + 2, so "<!-->" and "<!--->" end at once, like in a browser
    const end = comment ? html.indexOf("-->", lt + 2) : tag ? tagEnd(html, nameStart) : html.indexOf(">", lt + 2);
    if (end === -1) return parts.join("");
    if (comment) {
      i = end + 3;
      continue;
    }
    parts.push(" ");
    i = end + 1;
    if (bogus) continue;
    const name = /^[^\s/>]*/.exec(html.slice(nameStart, Math.min(end, nameStart + 16)))![0].toLowerCase();
    if (CONTENT.has(name)) {
      contentDepth = Math.max(0, contentDepth + (closing ? -1 : 1));
    } else if (PAGE_CHROME.has(name)) {
      if (closing) {
        if (chromeOpen[name] > 0) {
          chromeOpen[name]--;
          if (--chromeTotal === 0) parts.length = chromeStart;
        }
      } else if (name === "nav" || contentDepth === 0 || chromeTotal > 0) {
        if (chromeTotal++ === 0) chromeStart = parts.length;
        chromeOpen[name]++;
      }
    } else if (!closing && isRawText(name)) {
      const close = rawTextEnd(html, name, i);
      if (close === -1) return parts.join("");
      i = close; // its end tag is read as a tag, so "</script\n<p>" ends at ">"
    }
  }
  return parts.join("") + html.slice(i);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "",
  lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', laquo: "«", raquo: "»",
  hellip: "...", ndash: "-", mdash: "-", bull: "•", middot: "·", euro: "€",
  deg: "°", copy: "©", reg: "®", trade: "™", times: "×",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", ccedil: "ç",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", iacute: "í", icirc: "î", iuml: "ï",
  ntilde: "ñ", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oelig: "œ",
  uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü", szlig: "ß",
  Agrave: "À", Ccedil: "Ç", Eacute: "É", Egrave: "È", Ecirc: "Ê", Ocirc: "Ô",
};

/** What the HTML standard reads the numeric references 128 to 159 as: windows-1252 */
const WINDOWS_1252 = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];

/**
 * Numeric and common named entities, decoded in a single pass: "&amp;lt;"
 * stays the text "&lt;". WordPress writes "l&#8217;équipe" everywhere, and
 * undecoded entities used up the text budget. An unknown or invalid one stays.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z0-9]+));/g, (entity, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name] ?? entity;
    const number = dec ? Number(dec) : parseInt(hex, 16);
    const code = number >= 0x80 && number <= 0x9f ? WINDOWS_1252[number - 0x80] : number;
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : entity;
  });
}

/** Readable text of an HTML page, whitespace collapsed after decoding */
export function htmlToText(html: string): string {
  return decodeEntities(stripMarkup(html)).replace(/\s+/g, " ").trim().substring(0, MAX_PAGE_TEXT_CHARS);
}
