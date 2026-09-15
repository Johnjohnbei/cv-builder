import { describe, it, expect } from "vitest";
import { numbersOf } from "../numbers";

describe("numbersOf", () => {
  // A translated or reformatted number is the same fact, never an invention
  it("reads a number whatever its thousands separator or its words", () => {
    expect(numbersOf("Mené 1 500 entretiens")).toEqual(["1500"]);
    expect(numbersOf("Conducted 1,500 interviews")).toEqual(["1500"]);
    expect(numbersOf("Ran three workshops")).toEqual(["3"]);
    expect(numbersOf("Animé trois ateliers")).toEqual(["3"]);
  });

  it("reads a figure glued to its unit, never a digit inside a name", () => {
    expect(numbersOf("+30M d'utilisateurs, 40 %")).toEqual(["30", "40"]);
    expect(numbersOf("SaaS B2B sur S3")).toEqual([]);
  });

  it("reads through the markdown the templates render", () => {
    expect(numbersOf("**1 2**00 clients")).toEqual(numbersOf("1 200 clients"));
  });
});
