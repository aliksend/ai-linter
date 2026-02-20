import { describe, it, expect } from "vitest";
import { generateReport } from "../report.js";
import type { VerifiedIssue } from "../types.js";

describe("generateReport", () => {
  it("generates report with errors and warnings", () => {
    const issues: VerifiedIssue[] = [
      {
        confirmed: true,
        severity: "error",
        file: "src/a.ts",
        line: "10",
        rule: "no-foo",
        explanation: "Uses foo library which is banned.",
      },
      {
        confirmed: true,
        severity: "warning",
        file: "src/b.ts",
        line: "20-30",
        rule: "prefer-const",
        explanation: "Use const instead of let.",
      },
    ];
    const report = generateReport(issues, "/my/project");
    expect(report).toContain("# AI Linter Report");
    expect(report).toContain("1 error");
    expect(report).toContain("1 warning");
    expect(report).toContain("## Errors");
    expect(report).toContain("## Warnings");
    expect(report).toContain("`src/a.ts`");
    expect(report).toContain("**Строка 10**");
    expect(report).toContain("**Строки 20-30**");
    expect(report).toContain("[no-foo]");
    expect(report).toContain("[prefer-const]");
  });

  it("generates clean report when no issues", () => {
    const report = generateReport([], "/my/project");
    expect(report).toContain("# AI Linter Report");
    expect(report).toContain("0 errors, 0 warnings");
    expect(report).not.toContain("## Errors");
    expect(report).not.toContain("## Warnings");
  });

  it("formats single line and line ranges differently", () => {
    const issues: VerifiedIssue[] = [
      {
        confirmed: true,
        severity: "error",
        file: "x.ts",
        line: "5",
        rule: "r1",
        explanation: "Problem.",
      },
      {
        confirmed: true,
        severity: "error",
        file: "y.ts",
        line: "10-20",
        rule: "r2",
        explanation: "Another problem.",
      },
    ];
    const report = generateReport(issues, "/p");
    expect(report).toContain("**Строка 5**");
    expect(report).toContain("**Строки 10-20**");
  });
});
