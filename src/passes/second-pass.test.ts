import { describe, it, expect } from "vitest";
import { buildSecondPassPrompt, parseSecondPassSection } from "./second-pass.js";

describe("buildSecondPassPrompt", () => {
  it("includes issue section and rules in prompt", () => {
    const issueSection = `# no-foo: Uses foo library
- **File**: src/a.ts
- **Lines**: 10-20
- **Severity**: error
- **Description**: Uses foo library`;

    const prompt = buildSecondPassPrompt(issueSection, "allrules");
    expect(prompt).toContain("no-foo");
    expect(prompt).toContain("src/a.ts");
    expect(prompt).toContain("Uses foo library");
    expect(prompt).toContain("allrules");
    expect(prompt).toContain("REPORTED ISSUE:");
  });
});

describe("parseSecondPassSection", () => {
  it("returns section starting at first # heading", () => {
    const text = `The violation was confirmed.\n\n# no-console: console.log found\n- **File**: src/a.ts\n- **Severity**: error`;
    const result = parseSecondPassSection(text);
    expect(result).not.toBeNull();
    expect(result).toContain("# no-console");
    expect(result).not.toContain("The violation was confirmed");
  });

  it("returns section when response starts directly with #", () => {
    const text = `# no-foo: bad usage\n- **File**: src/b.ts`;
    expect(parseSecondPassSection(text)).toContain("# no-foo");
  });

  it("returns null when no # heading found", () => {
    expect(parseSecondPassSection("This is not a violation. The code looks fine.")).toBeNull();
    expect(parseSecondPassSection("")).toBeNull();
  });
});
