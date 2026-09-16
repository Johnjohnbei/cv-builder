import { describe, it, expect } from "vitest";
import { hasUnbackedNumber, numbersOf } from "../numbers";

describe("numbersOf", () => {
  // A translated or reformatted number is the same fact, never an invention
  it("reads a number whatever its thousands separator, its scale or its words", () => {
    expect(numbersOf("Mené 1 500 entretiens, conducted 1,500 interviews")).toEqual(["1500", "1500"]);
    expect(numbersOf("5k utilisateurs, 30M+ de visites, 30 millions de vues")).toEqual(["5000", "30000000", "30000000"]);
    expect(numbersOf("Ran three workshops, vingt ateliers, seventy clients")).toEqual(["3", "20", "70"]);
  });

  it("reads each word of a compound number, so a changed one is not backed by the others", () => {
    expect(numbersOf("cinq cents clients, quatre-vingts ateliers")).toEqual(["5", "100", "4", "20"]);
  });

  it("reads a multiplier, never a digit inside a name", () => {
    expect(numbersOf("Conversion multipliée par x3, puis ×3, 10x plus vite")).toEqual(["3", "3", "10"]);
    expect(numbersOf("SaaS B2B sur S3, iOS17, a11y, H264")).toEqual([]);
    // The x of a name is not the x of a multiplier, and a point does not end a name
    expect(numbersOf("Linux3, Nginx1, ffmpegx2, H.264")).toEqual([]);
    // A figure a letter follows is read, "3D" and "4K" included: an unread
    // figure is a figure the guard lets through, the graver of the two mistakes
    expect(numbersOf("rendu 3D, écran 4K")).toEqual(["3", "4000"]);
  });

  it("reads a decimal as one number, so half of it never backs it", () => {
    expect(numbersOf("1,5 M de CA, 2.5x plus vite, 0,5 ETP, ½ journée")).toEqual(["1500000", "2.5", "0.5", "0.5"]);
    expect(hasUnbackedNumber("2,5 M de CA et 1 projet", new Set(numbersOf("1,5 M de CA et 2 projets")))).toBe(true);
    // A thousands separator still groups: three digits after it
    expect(numbersOf("1 500 entretiens, 1,500 interviews")).toEqual(["1500", "1500"]);
  });

  it("reads a figure against any unit, so an invented one is not backed", () => {
    expect(numbersOf("30fps, 60Hz, 10cm, 15kW, 100Mbps, 5L, 3CV, 25TTC")).toEqual(["30", "60", "10", "15", "100", "5", "3", "25"]);
    expect(hasUnbackedNumber("Passé de 30fps à 120fps", new Set(numbersOf("Passé de 30fps à 60fps")))).toBe(true);
  });

  it("reads the digits of another script and their value", () => {
    expect(numbersOf("٣ projets, ١٢ clients")).toEqual(["3", "12"]);
  });

  // Read as 1 and 9, they removed legitimate bullets
  it("does not read the articles un, une, one nor neuf, pour cent nor the month sept.", () => {
    expect(numbersOf("Conçu un produit neuf, one of the first")).toEqual([]);
    expect(numbersOf("40 pour cent depuis sept. 2019")).toEqual(["40", "2019"]);
  });

  it("reads a figure written against its unit, never a name starting with digits", () => {
    expect(numbersOf("Latence 40ms, réponse sous 48h, livré en 3j, 5h/semaine, 16Go, 15e")).toEqual(["40", "48", "3", "5", "16", "15"]);
    // A name is longer than a unit: five letters glued to the figure at most
    expect(numbersOf("99designs, 360Learning")).toEqual([]);
    // "1080p" is a claim like any other: a CV that says 4K must be backed
    expect(numbersOf("vidéo 1080p")).toEqual(["1080"]);
    // The minutes of "2h30" are a number too: "2h45" is not backed by "2h30"
    expect(numbersOf("10ans, 12mois, 30jours, 100km, 1ère, 2h30")).toEqual(["10", "12", "30", "100", "1", "2", "30"]);
  });

  it("reads « un » in a compound only as a number part", () => {
    expect(numbersOf("one-hundred clients, deux-en-un, dix-neuf")).toEqual(["100", "2", "10", "9"]);
  });

  it("reads « sept » as the month only before a year or another month", () => {
    expect(numbersOf("de sept. à déc. 2019, sept.-déc., sept-oct 2020, mi-sept 2019")).toEqual(["2019", "2020", "2019"]);
    expect(numbersOf("Encadré une équipe de sept.")).toEqual(["7"]);
    expect(numbersOf("Encadré une équipe de sept. Livré 3 apps.")).toEqual(["3", "7"]);
    // A point is a sentence end far more often than a month: « Au total », « À Paris »
    expect(numbersOf("Encadré une équipe de sept. Au total, deux projets.")).toEqual(["7", "2"]);
    expect(numbersOf("Équipe de sept à dix personnes, sept au total")).toEqual(["7", "10", "7"]);
    // A fabricated seven used to pass, backed by a source that only says "trois à dix"
    expect(hasUnbackedNumber("Équipe de sept à dix personnes", new Set(numbersOf("Équipe de trois à dix personnes")))).toBe(true);
  });

  it("reads an approximate word apart from the exact figure, its translation included", () => {
    expect(numbersOf("des dizaines de clients")).toEqual(numbersOf("dozens of clients"));
    expect(numbersOf("une douzaine de clients")).toEqual(numbersOf("a dozen clients"));
    expect(numbersOf("une dizaine")).toEqual(["~10"]);
    expect(numbersOf("une douzaine")).toEqual(["~12"]);
    // "10 clients" is a count the source never gave, and "une douzaine" is not "12"
    expect(hasUnbackedNumber("10 clients", new Set(numbersOf("une dizaine de clients")))).toBe(true);
    expect(hasUnbackedNumber("12 clients", new Set(numbersOf("une douzaine de clients")))).toBe(true);
    expect(hasUnbackedNumber("des dizaines de clients", new Set(numbersOf("des dizaines de clients")))).toBe(false);
  });

  it("reads every part of a compound, never the verb seize nor per cent", () => {
    expect(numbersOf("une dizaine de clients, twenty-one, vingt-et-un")).toEqual(["~10", "20", "1", "20", "1"]);
    expect(numbersOf("Seize market share, 20 per cent, 30 pour-cent")).toEqual(["20", "30"]);
  });

  it("reads through the markdown the templates render", () => {
    expect(numbersOf("**1 2**00 clients")).toEqual(numbersOf("1 200 clients"));
  });
});

describe("hasUnbackedNumber", () => {
  // "1" from a date "2020-01" once backed an invented "1 500"
  it("backs a grouped number by its whole value, or by every one of its parts", () => {
    expect(hasUnbackedNumber("Mené 1 500 entretiens", new Set(["1"]))).toBe(true);
    expect(hasUnbackedNumber("Mené 1 500 entretiens", new Set(["1", "500"]))).toBe(false);
    expect(hasUnbackedNumber("Mené 1 500 entretiens", new Set(["1500"]))).toBe(false);
  });

  it("never backs a scaled figure by its bare number", () => {
    expect(hasUnbackedNumber("30M d'utilisateurs", new Set(["30"]))).toBe(true);
    expect(hasUnbackedNumber("30M d'utilisateurs", new Set(numbersOf("30 millions d'utilisateurs")))).toBe(false);
  });
});
