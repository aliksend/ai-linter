import { describe, it, expect } from "vitest";
import { buildClaudeArgs, parseClaudeResponse } from "../runner.js";

describe("buildClaudeArgs", () => {
  it("builds correct args for claude -p", () => {
    const args = buildClaudeArgs("check this code", "haiku");
    expect(args).toEqual([
      "-p", "check this code",
      "--model", "haiku",
      "--output-format", "json",
    ]);
  });
});

describe("parseClaudeResponse", () => {
  it("parses valid JSON from claude output", () => {
    const output = JSON.stringify({
      result: '{"issues": [{"file": "a.ts", "line": "1", "severity": "error", "rule": "no-foo", "description": "bad"}]}',
    });
    const result = parseClaudeResponse(output);
    expect(result).toEqual({
      issues: [{ file: "a.ts", line: "1", severity: "error", rule: "no-foo", description: "bad" }],
    });
  });
  
  it("parses JSON wrapped in markdown code fences", () => {
    const output = JSON.stringify({
      result: '```json\n{"issues": []}\n```',
    });
    const result = parseClaudeResponse(output);
    expect(result).toEqual({ issues: [] });
  });
  
  it("parses JSON wrapped in markdown code fences with prefix", () => {
    const output = JSON.stringify({
      result: 'Based on my analysis of the code, here are the violations found:\n\n```json\n{"issues": []}\n```',
    });
    const result = parseClaudeResponse(output);
    expect(result).toEqual({ issues: [] });
  });

  it("parses JSON wrapped in plain code fences", () => {
    const output = JSON.stringify({
      result: '```\n{"issues": []}\n```',
    });
    const result = parseClaudeResponse(output);
    expect(result).toEqual({ issues: [] });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseClaudeResponse("not json")).toThrow();
  });

  it("parses when result is already an object", () => {
    const output = JSON.stringify({
      result: { issues: [] },
    });
    const result = parseClaudeResponse(output);
    expect(result).toEqual({ issues: [] });
  });
});
