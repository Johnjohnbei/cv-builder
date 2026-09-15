import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPublicPage, htmlToText, isPublicAddress, isPublicUrl, parseHttpUrl, readTextUpTo, URL_ACTION_BUDGET_MS } from "../publicUrl";

const resolvesTo = (...addresses: string[]) => async () => addresses.map((address) => ({ address }));

const neverResolves = async (): Promise<never> => {
  throw new Error("must not be resolved");
};

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "::", "::ffff:7f00:1", "::a9fe:a9fe", "64:ff9b::a9fe:a9fe", "fd00::1", "febf::1", "fe80::1",
    "64:ff9b:1::a9fe:a9fe", "::ffff:0:7f00:1", "2002:a9fe:a9fe::1", "2002:7f00:1::1",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2", "fec0::1",
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700::6810:84e5", "2001:4860:4860::8888"])("accepts %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it("refuses what is not an address", () => {
    expect(isPublicAddress("example.com")).toBe(false);
  });
});

describe("parseHttpUrl (offline, before the access code)", () => {
  it("keeps an http(s) link, trimmed", () => {
    expect(parseHttpUrl(" https://jobs.example/offre/42 ")?.toString()).toBe("https://jobs.example/offre/42");
  });

  it.each([
    "ftp://jobs.example/",
    "https://user:pass@jobs.example/",
    "not a url",
    "http://[64:ff9b::a9fe:a9fe]/",
    "http://[::ffff:127.0.0.1]/",
    "http://0x7f.1/",
    "http://100.64.0.1/",
    "http://localhost:3000/",
    "http://app.localhost/",
    "http://localhost./",
    "http://foo.localhost./",
    "http://metadata.google.internal/",
    "http://printer.local/",
    "http://nas.home.arpa/",
    "http://localhost../",
    "http://x.local../",
    "http://metadata/",
    "http://instance-data/",
    "http://127.1../",
    "http://0x7f.1../",
    "http://a.1../",
    "http://1.2.3.4.5../",
    "http://256.0.0.1../",
  ])("refuses %s", (raw) => {
    expect(parseHttpUrl(raw)).toBeNull();
  });

  it("drops trailing dots from the host it returns, so the host fetched is the host checked", () => {
    expect(parseHttpUrl("http://8.8.8.8../offre")?.hostname).toBe("8.8.8.8");
    expect(parseHttpUrl("https://jobs.example../offre?id=1")?.toString()).toBe("https://jobs.example/offre?id=1");
  });

  it("keeps a public literal address, and a name that merely contains a reserved word", () => {
    expect(parseHttpUrl("http://8.8.8.8/")).not.toBeNull();
    expect(parseHttpUrl("https://local-jobs.example/")).not.toBeNull();
    expect(parseHttpUrl("https://internal.example/")).not.toBeNull();
  });
});

describe("isPublicUrl (DNS, after the access code)", () => {
  const url = (raw: string) => parseHttpUrl(raw)!;

  it("accepts a name that only resolves to public addresses", async () => {
    expect(await isPublicUrl(url("https://jobs.example/"), resolvesTo("93.184.216.34"))).toBe(true);
  });

  it("refuses a name with any private address among its answers", async () => {
    expect(await isPublicUrl(url("https://jobs.example/"), resolvesTo("93.184.216.34", "10.0.0.1"))).toBe(false);
  });

  it("refuses a name that does not resolve", async () => {
    expect(await isPublicUrl(url("https://nowhere.example/"), neverResolves)).toBe(false);
  });

  it("accepts a public literal address without resolving it", async () => {
    const resolved: string[] = [];
    const spy = async (host: string) => {
      resolved.push(host);
      return [];
    };
    expect(await isPublicUrl(url("http://8.8.8.8/"), spy)).toBe(true);
    expect(await isPublicUrl(url("http://8.8.8.8../"), spy)).toBe(true);
    expect(resolved).toEqual([]);
  });
});

describe("fetchPublicPage (one deadline for the whole page, redirects included)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Each hop used to get its own 15 s: four redirects took 60 s before the AI
  // call, and the URL action could outlive the 10-minute Convex limit.
  const redirectTo = (location: string) => new Response(null, { status: 302, headers: { location } });

  it("gives every hop the same deadline signal", async () => {
    const deadline = new AbortController().signal;
    const fetch = vi.fn()
      .mockResolvedValueOnce(redirectTo("http://8.8.8.8/offre"))
      .mockResolvedValueOnce(new Response("<p>Offre</p>", { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    expect(await fetchPublicPage(new URL("http://8.8.4.4/"), deadline)).toBe("<p>Offre</p>");
    expect(fetch.mock.calls.map(([, init]) => init.signal)).toEqual([deadline, deadline]);
  });

  it("waits 10 s at most by default, so the AI call keeps its budget", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));

    await fetchPublicPage(new URL("http://8.8.4.4/"));

    expect(timeout).toHaveBeenCalledWith(10_000);
  });

  /** A response whose body records being cancelled */
  const withBody = (status: number, headers: Record<string, string> = {}) => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull() {}, cancel });
    return { response: new Response(body, { status, headers }), cancel };
  };

  // An unread body holds the socket until it times out
  it("cancels the body of a redirect and of an error it does not read", async () => {
    const redirect = withBody(302, { location: "http://8.8.8.8/offre" });
    const notFound = withBody(404);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(redirect.response).mockResolvedValueOnce(notFound.response));

    expect(await fetchPublicPage(new URL("http://8.8.4.4/"), new AbortController().signal)).toBe("");
    expect(redirect.cancel).toHaveBeenCalled();
    expect(notFound.cancel).toHaveBeenCalled();
  });

  it("stops following redirects once the deadline has passed", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(async () => {
      controller.abort();
      return redirectTo("http://8.8.8.8/suite");
    });
    vi.stubGlobal("fetch", fetch);

    expect(await fetchPublicPage(new URL("http://8.8.4.4/"), controller.signal)).toBe("");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("htmlToText", () => {
  it("drops scripts, styles and page chrome, then decodes entities with &amp; last", () => {
    const html = "<header>Menu</header><nav>Liens</nav><style>p{}</style>"
      + "<p>Offre&nbsp;:  Designer &amp;lt;senior&amp;gt;</p><script>track()</script><footer>Pied</footer>";
    expect(htmlToText(html)).toBe("Offre : Designer &lt;senior&gt;");
  });

  it("keeps the first 15 000 characters", () => {
    expect(htmlToText(`<p>${"ab".repeat(10_000)}</p>`)).toBe("ab".repeat(7_500));
  });

  // Pages with a large inline script or data blob before the offer exist
  // (Next.js __NEXT_DATA__): a cut in the middle of that script sent code to the model.
  it("reads the offer after a script larger than a megabyte", () => {
    const html = `<head><script>${"var x=1;".repeat(160_000)}</script></head><h1>Offre Designer</h1>`;
    expect(htmlToText(html)).toBe("Offre Designer");
  });

  it("keeps the text of tags whose attribute contains a less-than sign", () => {
    expect(htmlToText('<div x-show="a < b">Texte</div>')).toBe("Texte");
  });

  it("keeps custom elements whose name only starts like a removed block", () => {
    expect(htmlToText("<header-bar>Titre</header-bar><navigation>Menu</navigation><p>Offre</p>")).toBe("Titre Menu Offre");
  });

  // Scripts first, like the original cleanup: a nav holding a script whose
  // string contains "</nav>" closed the nav there and leaked the script
  it("removes scripts before page chrome and comments", () => {
    expect(htmlToText("<nav><script>s='</nav>';leak()</script></nav><p>Offre</p>")).toBe("Offre");
    expect(htmlToText('<script>var s="<!--";</script><p>Offre</p>')).toBe("Offre");
  });

  it("keeps a less-than sign of running text", () => {
    expect(htmlToText("<p>a < b</p>")).toBe("a < b");
  });

  // A byte limit can cut a page inside a script: like a browser, the rest is script, never text
  it("drops an unclosed script or style to the end, but keeps the text of an unclosed nav", () => {
    expect(htmlToText("<p>Offre</p><script>var a = 1;")).toBe("Offre");
    expect(htmlToText("<p>Offre</p><style>p { color: red")).toBe("Offre");
    expect(htmlToText("<nav>Menu<p>Offre</p>")).toBe("Menu Offre");
  });

  it("closes a script on </script followed by anything up to >", () => {
    expect(htmlToText("<script>x()</script foo><p>Offre</p>")).toBe("Offre");
  });

  it("removes comments, a > inside them included, and an unclosed comment to the end", () => {
    expect(htmlToText("<!-- a > b --><p>Offre</p><!-- fin")).toBe("Offre");
  });

  it("keeps a > inside a quoted attribute from ending the tag", () => {
    expect(htmlToText('<div title="a>b">Texte</div>')).toBe("Texte");
  });

  // Like a browser tokenizer: a quote only opens a value right after "="
  it("reads an apostrophe in an unquoted value or a tag name as an ordinary character", () => {
    expect(htmlToText("<p class=l'offre>Rejoignez l'équipe produit</p><p>Suite</p>")).toBe("Rejoignez l'équipe produit Suite");
    expect(htmlToText("<img alt=L'équipe src=a.png><p>Offre</p><p>Suite</p>")).toBe("Offre Suite");
    expect(htmlToText('<a"b>Offre</a"b><p>Suite</p>')).toBe("Offre Suite");
  });

  // One pass sees comments, attributes and script text the way a browser does
  it("does not lose the page to markup hidden in a comment or an attribute", () => {
    expect(htmlToText("<!-- <script> --><p>Offre</p><script>real()</script><p>Suite</p>")).toBe("Offre Suite");
    expect(htmlToText('<div data-x="<!--">Offre</div><p>Suite</p><!-- vrai -->')).toBe("Offre Suite");
    expect(htmlToText('<div data-tpl="<style>">Offre</div><p>Suite</p><script>a()</script><p>Fin</p>')).toBe("Offre Suite Fin");
  });

  it("ends a bogus comment at the first >, quotes or not", () => {
    expect(htmlToText("<!x ' ><p>Offre</p><p>Suite l'x</p>")).toBe("Offre Suite l'x");
  });

  it("ends a closing script tag at its >, a < before it included", () => {
    expect(htmlToText("<script>x()</script\n<p>Offre</p>")).toBe("Offre");
  });

  it("drops a tag cut by the end of the page, never the text before it", () => {
    expect(htmlToText('<p>Offre</p><div class="x')).toBe("Offre");
  });

  it("drops nested page chrome", () => {
    expect(htmlToText("<nav>A<nav>B</nav>C</nav><p>Offre</p>")).toBe("Offre");
  });

  // A hostile page must not hold the action: these regexes used to go quadratic
  // on a few megabytes, past the Convex limit, where no deadline can stop CPU work.
  it.each([
    ["unclosed opening brackets", "<".repeat(2_000_000)],
    ["unclosed script tags", "<script>".repeat(250_000)],
    ["closing tags without opening ones", "</script".repeat(250_000)],
    ["an open script followed by unterminated closing tags", "<script>" + "</script ".repeat(250_000)],
    ["unclosed quotes inside tags", '<a "'.repeat(500_000)],
    ["unclosed comments", "<!--".repeat(500_000)],
    ["page chrome after a long text", "a".repeat(1_000_000) + "<nav>x</nav>".repeat(300_000)],
    ["bogus comments", "<!x>".repeat(500_000)],
  ])("stays fast on %s", (_name, html) => {
    const startedAt = performance.now();
    htmlToText(html);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });
});

describe("readTextUpTo", () => {
  const chunked = (chunks: string[]) => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
      cancel,
    });
    return { response: new Response(body), cancel };
  };

  // Old job boards still serve Latin-1: decoded as UTF-8 their accents became U+FFFD
  it("decodes the charset the response declares", async () => {
    const latin1 = new Uint8Array([0x65, 0x78, 0x70, 0xe9, 0x72, 0x69, 0x65, 0x6e, 0x63, 0x65]);
    const response = new Response(latin1, { headers: { "content-type": "text/html; charset=ISO-8859-1" } });
    expect(await readTextUpTo(response, 1_000)).toBe(`exp${String.fromCodePoint(0xe9)}rience`);
  });

  it("reads the charset of a meta tag when the header names none", async () => {
    const head = new TextEncoder().encode('<meta charset="windows-1252"><p>exp');
    const response = new Response(new Uint8Array([...head, 0xe9, 0x72, 0x69, 0x65, 0x6e, 0x63, 0x65]));
    expect(await readTextUpTo(response, 1_000)).toBe(`<meta charset="windows-1252"><p>exp${String.fromCodePoint(0xe9)}rience`);
  });

  it("falls back to UTF-8 on an unknown charset", async () => {
    const response = new Response("Offre", { headers: { "content-type": "text/html; charset=klingon" } });
    expect(await readTextUpTo(response, 1_000)).toBe("Offre");
  });

  it("reads no body as empty text", async () => {
    expect(await readTextUpTo(new Response(null), 10)).toBe("");
  });

  it("keeps a multibyte character split across chunks", async () => {
    const bytes = new TextEncoder().encode("é€");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const b of bytes) controller.enqueue(new Uint8Array([b]));
        controller.close();
      },
    });
    expect(await readTextUpTo(new Response(body), 1_000)).toBe(String.fromCodePoint(0xe9, 0x20ac));
  });

  // A replacement character would be invented text
  it("drops a character the byte limit cuts in half", async () => {
    const response = new Response(String.fromCodePoint(0xe9, 0x20ac));
    expect(await readTextUpTo(response, 4)).toBe(String.fromCodePoint(0xe9));
  });

  it("reads a small body whole", async () => {
    expect(await readTextUpTo(chunked(["<p>", "Offre", "</p>"]).response, 1_000)).toBe("<p>Offre</p>");
  });

  // A page of hundreds of megabytes must not fill the action's memory
  it("stops at the byte limit and cancels the rest of the download", async () => {
    const { response, cancel } = chunked(["a".repeat(600), "b".repeat(600), "c".repeat(600)]);
    const text = await readTextUpTo(response, 1_000);
    expect(text).toBe("a".repeat(600) + "b".repeat(400));
    expect(cancel).toHaveBeenCalled();
  });
});

describe("URL action budget", () => {
  // Raising one of these timeouts used to break the 10-minute limit silently
  it("stays under the 10-minute Convex action limit, with room for the access check", () => {
    expect(URL_ACTION_BUDGET_MS).toBeLessThanOrEqual(595_000);
  });
});
