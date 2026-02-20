import { describe, it, expect } from "vitest";
import { buildSecondPassPrompt, parseSecondPassResponse } from "../passes/second-pass.js";

describe("buildSecondPassPrompt", () => {
  it("includes issue details in prompt", () => {
    const prompt = buildSecondPassPrompt({
      file: "src/a.ts",
      line: "10-20",
      severity: "error",
      rule: "no-foo",
      description: "Uses foo library",
    });
    expect(prompt).toContain("no-foo");
    expect(prompt).toContain("src/a.ts");
    expect(prompt).toContain("Uses foo library");
  });
});

describe("parseSecondPassResponse", () => {
  it("returns verified issue when confirmed", () => {
    const result = parseSecondPassResponse({
      confirmed: true,
      severity: "error",
      file: "a.ts",
      line: "10",
      rule: "no-foo",
      explanation: "The file imports foo which is banned.",
    });
    expect(result).not.toBeNull();
    expect(result!.confirmed).toBe(true);
  });

  it("returns null when not confirmed", () => {
    const result = parseSecondPassResponse({ confirmed: false });
    expect(result).toBeNull();
  });

  it("returns null for malformed response", () => {
    const result = parseSecondPassResponse({ random: "stuff" });
    expect(result).toBeNull();
  });
});
