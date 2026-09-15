"use node";

import { lookup } from "dns/promises";
import { BlockList, isIP } from "net";
import { AI_CALL_WORST_CASE_MS } from "./chat";

// ─── Fetching a URL the user pasted ─────────────────────────────────
// The server fetches it, so the URL is untrusted input: it must never reach
// the deployment's own network (loopback, private ranges, cloud metadata).
// Extracted from ai.ts, which was over its size limit.

// Every range a public web page never lives on, IPv6 forms embedding an IPv4
// included. One list per family: a single BlockList matches IPv4 addresses
// against IPv6 rules too, and ::ffff:0:0/96 then refused every IPv4 address.
const NON_PUBLIC_V4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) {
  NON_PUBLIC_V4.addSubnet(network, prefix, "ipv4");
}
const NON_PUBLIC_V6 = new BlockList();
for (const [network, prefix] of [
  // IPv4-compatible and unspecified/loopback, IPv4-mapped, IPv4-translated,
  // NAT64 (well-known and local-use), 6to4, Teredo, unique-local, site-local,
  // link-local, multicast
  ["::", 96], ["::ffff:0:0", 96], ["::ffff:0:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48],
  ["2002::", 16], ["2001::", 32], ["fc00::", 7], ["fec0::", 10], ["fe80::", 10], ["ff00::", 8],
] as const) {
  NON_PUBLIC_V6.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !NON_PUBLIC_V4.check(address, "ipv4");
  return family === 6 && !NON_PUBLIC_V6.check(address, "ipv6");
}

type Resolve = (hostname: string) => Promise<{ address: string }[]>;

/** A resolver that never answers must not hold the action until its own limit */
const DNS_TIMEOUT_MS = 5_000;
/** Jina Reader, tried first by the URL action (convex/ai.ts) */
export const JINA_TIMEOUT_MS = 15_000;
/** Jina already returns text, and the model gets 15 000 characters of it */
export const JINA_MAX_BYTES = 200_000;
/** fetchPublicPage, every redirect included */
const PAGE_DEADLINE_MS = 10_000;
/** A real offer page, inline scripts included, is far below this */
const MAX_PAGE_BYTES = 5_000_000;

/**
 * Worst case of the URL action: the DNS check, Jina, the page with a redirect's
 * DNS check running past its deadline, then the AI call. Must stay under the
 * 10-minute Convex limit, with room for the access check.
 */
export const URL_ACTION_BUDGET_MS = DNS_TIMEOUT_MS + JINA_TIMEOUT_MS + PAGE_DEADLINE_MS + DNS_TIMEOUT_MS + AI_CALL_WORST_CASE_MS;

const resolveAll: Resolve = (hostname) =>
  Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("DNS timeout")), DNS_TIMEOUT_MS).unref();
    }),
  ]);

/** The host without IPv6 brackets or trailing dots ("8.8.8.8.." is the address 8.8.8.8) */
const hostOf = (url: URL) => url.hostname.replace(/^\[(.*)\]$/, "$1").replace(/\.+$/, "");

/**
 * The pasted text as an http(s) URL without credentials, or null, also when
 * it names a non-public host outright (a literal address, localhost). No
 * network access, so it runs before the access code is used up: a private
 * address typed by mistake costs no code use.
 */
export function parseHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  // Names reserved for local networks, and single-label names ("metadata"),
  // never resolve to a public page; trailing dots ("localhost..") change nothing
  // The host checked must be the host fetched: "8.8.8.8.." passed as 8.8.8.8
  // and then went to DNS as "8.8.8.8..". The setter re-parses ("127.1.." becomes
  // 127.0.0.1), so the host is read back after it, never before.
  if (/\.$/.test(url.hostname)) url.hostname = hostOf(url);
  // The setter silently ignores a value it cannot parse ("a.1", "256.0.0.1"):
  // the host would be checked without its dots and fetched with them
  if (url.hostname.endsWith(".")) return null;
  const host = hostOf(url);
  if (isIP(host)) return isPublicAddress(host) ? url : null;
  return !host.includes(".") || /(^|\.)(localhost|local|internal|home\.arpa)$/i.test(host) ? null : url;
}

/**
 * Whether every address `url` points to is public. A name is resolved: a
 * pattern on the literal host let `[64:ff9b::a9fe:a9fe]`, 100.64.0.0/10 or a
 * DNS name pointing at 10.0.0.1 through. Kept apart from parseHttpUrl so the
 * caller resolves only after the access code: an anonymous caller must not be
 * able to probe DNS through the deployment.
 *
 * ponytail: resolved here, then again by fetch; a DNS answer that changes in
 * between (rebinding) is not caught. Upgrade path: connect to the checked
 * address through an undici dispatcher with a custom lookup.
 */
export async function isPublicUrl(url: URL, resolve: Resolve = resolveAll): Promise<boolean> {
  const host = hostOf(url);
  try {
    const addresses = isIP(host) ? [{ address: host }] : await resolve(host);
    return addresses.length > 0 && addresses.every((a) => isPublicAddress(a.address));
  } catch {
    return false; // a name that does not resolve is not a page anyone can read
  }
}

/**
 * Page body of a public URL, redirects followed by hand so every hop is
 * checked: a public page redirecting to an internal address would otherwise be
 * followed blindly. A non-2xx answer yields "": a 404 or a login wall used to
 * be passed to the model as if it were the offer.
 *
 * One deadline covers every hop: 15 s per hop let four redirects take a minute
 * before the AI call. A redirect's DNS check can still run up to 5 s past it,
 * and no hop starts after it. The whole budget is URL_ACTION_BUDGET_MS.
 */
export async function fetchPublicPage(start: URL, deadline: AbortSignal = AbortSignal.timeout(PAGE_DEADLINE_MS)): Promise<string> {
  let url = start;
  for (let hop = 0; hop < 4 && !deadline.aborted; hop++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "manual",
      signal: deadline,
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      response.body?.cancel().catch(() => {}); // an unread body holds the socket
      const next = parseHttpUrl(new URL(location, url).toString());
      if (!next || !(await isPublicUrl(next))) return "";
      url = next;
      continue;
    }
    if (!response.ok) {
      response.body?.cancel().catch(() => {});
      return "";
    }
    return await readTextUpTo(response, MAX_PAGE_BYTES);
  }
  return "";
}

/**
 * Body of a response as text, read up to `maxBytes`, the rest of the download
 * cancelled: `response.text()` held a page of any size in the action's memory.
 * A character the limit cuts in half is dropped, never replaced by U+FFFD.
 */
export async function readTextUpTo(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  let decoder: TextDecoder | undefined;
  let text = "";
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) return text + (decoder?.decode() ?? "");
    decoder ??= decoderFor(response.headers.get("content-type"), value);
    const kept = value.subarray(0, maxBytes - bytes);
    bytes += kept.byteLength;
    text += decoder.decode(kept, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return text;
}

/**
 * Decoder for the charset the header declares, else a meta tag of the first
 * chunk, else UTF-8: old job boards still serve Latin-1, whose accents decoded
 * as UTF-8 became U+FFFD.
 * ponytail: a meta tag past the first chunk is missed; read ahead if one shows up.
 */
function decoderFor(contentType: string | null, head: Uint8Array): TextDecoder {
  const charset = /charset\s*=\s*["']?([\w:.-]+)/i;
  const label = charset.exec(contentType ?? "")?.[1]
    ?? charset.exec(new TextDecoder("latin1").decode(head.subarray(0, 2_048)))?.[1];
  try {
    return new TextDecoder(label ?? "utf-8");
  } catch {
    return new TextDecoder();
  }
}

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

const RAW_TEXT_END: Record<string, RegExp> = { script: /<\/script(?=[\s/>])/gi, style: /<\/style(?=[\s/>])/gi };
const PAGE_CHROME = new Set(["nav", "header", "footer"]);

/**
 * Text of the page without its markup, scripts, styles, comments and page
 * chrome, read in one linear pass the way a browser tokenizes: a hostile page
 * must not hold the action, and no deadline stops CPU work. Separate passes
 * disagreed on what was markup ("<!--" inside an attribute, "<script>" inside
 * a comment) and lost the rest of the page.
 *
 * A page cut by the byte limit ends like in a browser: an unclosed script or
 * style, comment or tag runs to the end; an unclosed nav keeps its text.
 */
function stripMarkup(html: string): string {
  const parts: string[] = [];
  let chromeDepth = 0;
  let chromeStart = 0; // parts dropped when the outermost chrome closes
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
    const end = comment ? html.indexOf("-->", lt + 4) : tag ? tagEnd(html, nameStart) : html.indexOf(">", lt + 2);
    if (end === -1) return parts.join("");
    if (comment) {
      i = end + 3;
      continue;
    }
    parts.push(" ");
    i = end + 1;
    if (bogus) continue;
    const name = /^[^\s/>]*/.exec(html.slice(nameStart, Math.min(end, nameStart + 16)))![0].toLowerCase();
    if (PAGE_CHROME.has(name)) {
      if (!closing && chromeDepth++ === 0) chromeStart = parts.length;
      else if (closing && chromeDepth > 0 && --chromeDepth === 0) parts.length = chromeStart;
    } else if (!closing && RAW_TEXT_END[name]) {
      const rawEnd = RAW_TEXT_END[name];
      rawEnd.lastIndex = i;
      const close = rawEnd.exec(html);
      if (!close) return parts.join("");
      i = close.index; // its end tag is read as a tag, so "</script\n<p>" ends at ">"
    }
  }
  return parts.join("") + html.slice(i);
}

/**
 * Readable text of an HTML page. Entities are decoded after the tags are gone,
 * &amp; last so "&amp;lt;" stays the text "&lt;", and whitespace is collapsed
 * after decoding.
 */
export function htmlToText(html: string): string {
  return stripMarkup(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, MAX_PAGE_TEXT_CHARS);
}
