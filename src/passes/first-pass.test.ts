import { describe, it, expect } from "vitest";
import { buildFirstPassPrompt, parseFirstPassSections } from "./first-pass.js";

describe("buildFirstPassPrompt", () => {
  it("includes rules content in prompt", () => {
    const prompt = buildFirstPassPrompt("No foo library allowed");
    expect(prompt).toContain("No foo library allowed");
    expect(prompt).toContain("RULES:");
    expect(prompt).toContain("# ");
  });
});

describe("parseFirstPassSections", () => {
  it("splits response into sections by # headings", () => {
    const text = `# no-console: console.log found
- **File**: src/a.ts
- **Line**: 10
- **Severity**: error
- **Description**: Uses console.log

# missing-return-type: function lacks return type
- **File**: src/b.ts
- **Lines**: 5-8
- **Severity**: warning
- **Description**: Missing explicit return type`;

    const sections = parseFirstPassSections(text);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toContain("no-console");
    expect(sections[0]).toContain("src/a.ts");
    expect(sections[1]).toContain("missing-return-type");
    expect(sections[1]).toContain("src/b.ts");
  });

  it("returns empty array when no issues", () => {
    expect(parseFirstPassSections("No issues found.")).toEqual([]);
    expect(parseFirstPassSections("")).toEqual([]);
  });

  it("handles single section", () => {
    const text = `# rule-name: description\n- **File**: foo.ts`;
    const sections = parseFirstPassSections(text);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain("rule-name");
  });
});
