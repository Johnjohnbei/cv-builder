import { describe, it, expect } from "vitest";
import { htmlToText } from "../htmlText";

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

  // A browser ignores an end tag with no open element of that name
  it("closes page chrome only with its own end tag", () => {
    expect(htmlToText("<nav>Menu</header><p>Offre</p></nav><p>Fin</p>")).toBe("Fin");
  });

  // Career sites put the job title in <article><header>: only the page's own header is chrome
  it("keeps the header and footer of an article or the main content", () => {
    const page = "<header>Menu</header><article><header><h1>Product Designer</h1><p>Paris, CDI</p></header>"
      + "<p>Missions</p><footer>Publiée le 3 mai</footer></article><footer>Pied</footer>";
    expect(htmlToText(page)).toBe("Product Designer Paris, CDI Missions Publiée le 3 mai");
  });

  it("reads a tag named like an Object property as an ordinary tag", () => {
    expect(htmlToText("<constructor>x</constructor><p>Offre</p><toString>y</toString>")).toBe("x Offre y");
  });

  it("ends the abrupt comments <!--> and <!---> at once, like a browser", () => {
    expect(htmlToText("<!-->Offre<!-- x --><p>Suite</p>")).toBe("Offre Suite");
    expect(htmlToText("<!--->Offre<p>Suite</p>")).toBe("Offre Suite");
  });

  // Old ad code: document.write of a script inside an escaped script
  it("keeps a script written inside an escaped script from ending it", () => {
    expect(htmlToText('<script><!-- document.write("<script>x()</script>"); --></script><p>Offre</p>')).toBe("Offre");
  });

  // Fetched without JavaScript, a page shows "enable JavaScript" there: not the offer
  it("drops noscript content, like a browser running scripts", () => {
    expect(htmlToText("<noscript>Activez JavaScript</noscript><p>Offre</p>")).toBe("Offre");
  });

  // Old Latin-1 sites write the Windows apostrophe as &#146;, which the HTML standard reads as windows-1252
  it("reads numeric references 128 to 159 as windows-1252, and more named entities", () => {
    expect(htmlToText("<p>l&#146;offre &#150; Z&uuml;rich, S&atilde;o Paulo, 20&deg;, caf&eacute;&shy;s</p>"))
      .toBe(`l${String.fromCodePoint(0x2019)}offre ${String.fromCodePoint(0x2013)} Zürich, São Paulo, 20°, cafés`);
  });

  // WordPress writes l&#8217;équipe everywhere
  it("decodes numeric and common named entities, once", () => {
    const html = "<p>l&#8217;&eacute;quipe &quot;produit&quot; &#x27;ok&#39; &Eacute;t&eacute; &amp;amp; &#0; &nope;</p>";
    expect(htmlToText(html)).toBe(`l${String.fromCodePoint(0x2019)}équipe "produit" 'ok' Été &amp; &#0; &nope;`);
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
    ["open page chrome closed by other names", "<nav>".repeat(500_000) + "</header>".repeat(500_000)],
  ])("stays fast on %s", (_name, html) => {
    const startedAt = performance.now();
    htmlToText(html);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });
});
