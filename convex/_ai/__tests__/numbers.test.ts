import { describe, it, expect } from "vitest";
import { numberReadings } from "../numbers";

describe("numberReadings", () => {
  // A translated or reformatted number is the same fact, never an invention
  it("reads a number whatever its thousands separator, its scale or its words", () => {
    expect(numberReadings("Mené 1 500 entretiens")).toEqual([["1500", "1", "500"]]);
    expect(numberReadings("Conducted 1,500 interviews")).toEqual([["1500", "1", "500"]]);
    expect(numberReadings("5k utilisateurs, 30M+ de visites")).toEqual([["5000", "5"], ["30000000", "30"]]);
    expect(numberReadings("Ran three workshops, vingt ateliers")).toEqual([["3"], ["20"]]);
  });

  it("reads a multiplier, never a digit inside a name", () => {
    expect(numberReadings("Conversion multipliée par x3")).toEqual([["3"]]);
    expect(numberReadings("SaaS B2B sur S3")).toEqual([]);
  });

  // Read as 1 and 9, they removed legitimate bullets
  it("does not read the articles un, une, one nor neuf as numbers", () => {
    expect(numberReadings("Conçu un produit neuf, one of the first")).toEqual([]);
  });

  it("reads through the markdown the templates render", () => {
    expect(numberReadings("**1 2**00 clients")).toEqual(numberReadings("1 200 clients"));
  });
});
