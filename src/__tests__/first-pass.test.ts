import { describe, it, expect } from "vitest";
import { buildFirstPassPrompt, parseFirstPassResponse } from "../passes/first-pass.js";

describe("buildFirstPassPrompt", () => {
  it("includes rules content in prompt", () => {
    const prompt = buildFirstPassPrompt("No foo library allowed");
    expect(prompt).toContain("No foo library allowed");
    expect(prompt).toContain("RULES:");
    expect(prompt).toContain('"issues"');
  });
});

describe("parseFirstPassResponse", () => {
  it("parses valid issues array", () => {
    const response = {
      issues: [
        { file: "a.ts", line: "10", severity: "error", rule: "no-foo", description: "bad" },
      ],
    };
    const issues = parseFirstPassResponse(response);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("returns empty array for no issues", () => {
    const issues = parseFirstPassResponse({ issues: [] });
    expect(issues).toHaveLength(0);
  });

  it("returns empty array for malformed response", () => {
    const issues = parseFirstPassResponse({ something: "else" });
    expect(issues).toHaveLength(0);
  });
});
