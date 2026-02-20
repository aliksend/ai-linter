import { describe, it, expect } from "vitest";
import { buildSecondPassPrompt } from "./second-pass.js";

describe("buildSecondPassPrompt", () => {
  it("includes issue details in prompt", () => {
    const prompt = buildSecondPassPrompt(
      {
        file: "src/a.ts",
        line: "10-20",
        severity: "error",
        rule: "no-foo",
        description: "Uses foo library",
      },
      "allrules",
    );
    expect(prompt).toContain("no-foo");
    expect(prompt).toContain("src/a.ts");
    expect(prompt).toContain("Uses foo library");
    expect(prompt).toContain("allrules");
  });
});
