import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { buildClaudeArgs, parseClaudeResponse, runClaudeWithRetry } from "../runner.js";

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

describe("runClaudeWithRetry", () => {
  const schema = z.object({ value: z.string() });

  it("returns parsed data when first attempt succeeds", async () => {
    const executor = vi.fn().mockResolvedValueOnce({ value: "ok" });
    const result = await runClaudeWithRetry("prompt", "model", "/cwd", schema, 3, executor);
    expect(result).toEqual({ value: "ok" });
  });

  it("retries and succeeds on second attempt", async () => {
    const executor = vi.fn()
      .mockResolvedValueOnce({ wrong: "shape" })
      .mockResolvedValueOnce({ value: "ok" });
    const result = await runClaudeWithRetry("prompt", "model", "/cwd", schema, 3, executor);
    expect(result).toEqual({ value: "ok" });
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("throws after maxRetries failed attempts and includes Zod error", async () => {
    const executor = vi.fn().mockResolvedValue({ wrong: "shape" });
    await expect(runClaudeWithRetry("prompt", "model", "/cwd", schema, 3, executor))
      .rejects.toThrow("Claude returned invalid response after 3 attempts");
  });

  it("throws error message containing Zod issue details", async () => {
    const executor = vi.fn().mockResolvedValue({ wrong: "shape" });
    await expect(runClaudeWithRetry("prompt", "model", "/cwd", schema, 1, executor))
      .rejects.toThrow("value");
  });

  it("propagates executor errors immediately without retrying", async () => {
    const executor = vi.fn().mockRejectedValue(new Error("spawn failed"));
    await expect(runClaudeWithRetry("prompt", "model", "/cwd", schema, 3, executor))
      .rejects.toThrow("spawn failed");
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
