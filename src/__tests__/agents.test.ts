import { describe, it, expect } from "vitest";
import { ClaudeAgent, QwenAgent, createAgent } from "../agents.js";

describe("ClaudeAgent", () => {
  const agent = new ClaudeAgent();

  it("has correct command", () => {
    expect(agent.command).toBe("claude");
  });

  it("builds correct args", () => {
    expect(agent.buildArgs("my prompt", "haiku")).toEqual([
      "-p", "my prompt", "--model", "haiku", "--output-format", "json",
    ]);
  });

  it("parses valid JSON result string", () => {
    const stdout = JSON.stringify({ result: '{"issues":[]}' });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("parses result already an object", () => {
    const stdout = JSON.stringify({ result: { issues: [] } });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("parses result wrapped in markdown fences", () => {
    const stdout = JSON.stringify({ result: "```json\n{\"issues\":[]}\n```" });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("parses result with text prefix before fences", () => {
    const stdout = JSON.stringify({
      result: "Here are the results:\n\n```json\n{\"issues\":[]}\n```",
    });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("throws when result field is missing", () => {
    expect(() => agent.parseResponse(JSON.stringify({}))).toThrow("missing 'result'");
  });

  it("parses result wrapped in plain code fences", () => {
    const stdout = JSON.stringify({ result: "```\n{\"issues\":[]}\n```" });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });
});

describe("QwenAgent", () => {
  const agent = new QwenAgent();

  it("has correct command", () => {
    expect(agent.command).toBe("qwen");
  });

  it("builds args with prompt as positional", () => {
    expect(agent.buildArgs("my prompt", "qwen-max")).toEqual([
      "my prompt", "--model", "qwen-max", "--output-format", "json",
    ]);
  });

  it("parses valid JSON result string", () => {
    const stdout = JSON.stringify({ result: '{"issues":[]}' });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("throws when result field is missing", () => {
    expect(() => agent.parseResponse(JSON.stringify({}))).toThrow("missing 'result'");
  });
});

describe("createAgent", () => {
  it("returns ClaudeAgent for 'claude'", () => {
    expect(createAgent("claude")).toBeInstanceOf(ClaudeAgent);
  });

  it("returns QwenAgent for 'qwen'", () => {
    expect(createAgent("qwen")).toBeInstanceOf(QwenAgent);
  });
});
