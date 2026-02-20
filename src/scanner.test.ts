import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { scanForRuleFiles } from "./scanner.js";

const TMP = join(import.meta.dirname, "../../.tmp-test-scanner");

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("scanForRuleFiles", () => {
  it("finds .ai-linter.md in root", async () => {
    writeFileSync(join(TMP, ".ai-linter.md"), "# Rules\nNo foo allowed");
    const results = await scanForRuleFiles(TMP);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("# Rules\nNo foo allowed");
    expect(results[0].dir).toBe(TMP);
  });

  it("finds .ai-linter.md in nested directories", async () => {
    writeFileSync(join(TMP, ".ai-linter.md"), "root rules");
    mkdirSync(join(TMP, "sub", "deep"), { recursive: true });
    writeFileSync(join(TMP, "sub", "deep", ".ai-linter.md"), "deep rules");
    const results = await scanForRuleFiles(TMP);
    expect(results).toHaveLength(2);
  });

  it("returns empty array when no rule files found", async () => {
    const results = await scanForRuleFiles(TMP);
    expect(results).toHaveLength(0);
  });

  it("skips node_modules", async () => {
    mkdirSync(join(TMP, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(TMP, "node_modules", "pkg", ".ai-linter.md"), "skip me");
    const results = await scanForRuleFiles(TMP);
    expect(results).toHaveLength(0);
  });
});
