import { describe, it, expect } from "vitest";
import { generateReport } from "./report.js";

const section1 = `# no-foo: Uses foo library
- **File**: src/a.ts
- **Lines**: 10
- **Severity**: error
- **Explanation**: Uses foo library which is banned.`;

const section2 = `# prefer-const: use const instead of let
- **File**: src/b.ts
- **Lines**: 20-30
- **Severity**: warning
- **Explanation**: Use const instead of let.`;

describe("generateReport", () => {
  it("generates report with confirmed sections", () => {
    const report = generateReport([section1, section2]);
    expect(report).toContain("# AI Linter Report");
    expect(report).toContain("2 confirmed issues");
    expect(report).toContain(section1);
    expect(report).toContain(section2);
  });

  it("generates clean report when no issues", () => {
    const report = generateReport([]);
    expect(report).toContain("# AI Linter Report");
    expect(report).toContain("0 confirmed issues");
    expect(report).not.toContain("---");
  });

  it("uses singular word for one issue", () => {
    const report = generateReport([section1]);
    expect(report).toContain("1 confirmed issue");
  });
});
