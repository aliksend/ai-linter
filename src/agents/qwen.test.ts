import { describe, it, expect } from "vitest";
import { QwenAgent } from "./qwen.js";

describe("QwenAgent", () => {
  const agent = new QwenAgent();

  it("has correct command", () => {
    expect(agent.command).toBe("qwen");
  });

  it("builds args with prompt as positional", () => {
    expect(agent.buildArgs("my prompt", "qwen-max")).toEqual([
      "my prompt",
      "--model",
      "qwen-max",
      "--output-format",
      "json",
    ]);
  });

  it("parses valid JSON result string", () => {
    const stdout = JSON.stringify([{ foo: "bar" }, { result: '{"issues":[]}' }]);
    expect(agent.getJsonResponse(stdout)).toEqual('{"issues":[]}');
  });

  it("throws when result field is missing", () => {
    expect(() => agent.getJsonResponse(JSON.stringify([]))).toThrow("missing 'result'");
  });
});
