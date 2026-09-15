// ─── Readable text of an offer page ─────────────────────────────────
// Extracted from publicUrl.ts, over its size limit: fetching stays there, this
// file only reads the HTML it fetched. Every scanner is linear: a hostile page
// must not hold the action, and no deadline stops CPU work.

/** Page text handed to the model */
const MAX_PAGE_TEXT_CHARS = 15_000;

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
const STYLE_END = /<\/style(?=[\s/>])/gi;

/**
 * Index of the "</script" or "</style" ending the raw text that starts at
 * `from`, -1 when the page ends first. A script keeps a browser's escape
 * states: a "<script>" written inside "<!-- -->" opens a nested one, whose end
 * tag does not end the script.
 */
function rawTextEnd(html: string, name: "script" | "style", from: number): number {
  if (name === "style") {
    STYLE_END.lastIndex = from;
    return STYLE_END.exec(html)?.index ?? -1;
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
  const chrome: string[] = []; // open chrome elements, outermost first
  let chromeStart = 0; // parts dropped when the outermost one closes
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
      // An end tag closes its own element only, like a browser's
      const at = closing ? chrome.lastIndexOf(name) : -1;
      if (at !== -1) {
        chrome.length = at;
        if (at === 0) parts.length = chromeStart;
      } else if (!closing && (name === "nav" || contentDepth === 0 || chrome.length > 0)) {
        if (chrome.length === 0) chromeStart = parts.length;
        chrome.push(name);
      }
    } else if (!closing && (name === "script" || name === "style")) {
      const close = rawTextEnd(html, name, i);
      if (close === -1) return parts.join("");
      i = close; // its end tag is read as a tag, so "</script\n<p>" ends at ">"
    }
  }
  return parts.join("") + html.slice(i);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', laquo: "«", raquo: "»",
  hellip: "...", ndash: "-", mdash: "-", bull: "•", middot: "·", euro: "€",
  agrave: "à", acirc: "â", ccedil: "ç", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  icirc: "î", iuml: "ï", ocirc: "ô", ugrave: "ù", ucirc: "û", oelig: "œ",
  Agrave: "À", Ccedil: "Ç", Eacute: "É", Egrave: "È", Ecirc: "Ê",
};

/**
 * Numeric and common named entities, decoded in a single pass: "&amp;lt;"
 * stays the text "&lt;". WordPress writes "l&#8217;équipe" everywhere, and
 * undecoded entities used up the text budget. An unknown or invalid one stays.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z]+));/g, (entity, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name] ?? entity;
    const code = dec ? Number(dec) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : entity;
  });
}

/** Readable text of an HTML page, whitespace collapsed after decoding */
export function htmlToText(html: string): string {
  return decodeEntities(stripMarkup(html)).replace(/\s+/g, " ").trim().substring(0, MAX_PAGE_TEXT_CHARS);
}
