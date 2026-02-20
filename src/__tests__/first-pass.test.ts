import { describe, it, expect } from "vitest";
import { buildFirstPassPrompt } from "../passes/first-pass.js";

describe("buildFirstPassPrompt", () => {
  it("includes rules content in prompt", () => {
    const prompt = buildFirstPassPrompt("No foo library allowed");
    expect(prompt).toContain("No foo library allowed");
    expect(prompt).toContain("RULES:");
    expect(prompt).toContain('"issues"');
  });
});
