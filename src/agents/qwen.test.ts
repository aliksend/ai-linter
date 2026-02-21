import { describe, it, expect } from "vitest";
import { QwenAgent } from "./qwen.js";

describe("QwenAgent", () => {
  const agent = new QwenAgent();

  it("has correct command", () => {
    expect(agent.command).toBe("qwen");
  });

  it("builds args with provided model", () => {
    expect(agent.buildArgs("my prompt", "qwen-max")).toEqual([
      "my prompt",
      "--output-format",
      "json",
      "--model",
      "qwen-max",
    ]);
  });

  it("builds args without provided model", () => {
    expect(agent.buildArgs("my prompt", undefined)).toEqual(["my prompt", "--output-format", "json"]);
  });

  it("returns plain text from last result field", () => {
    const stdout = JSON.stringify([{ foo: "bar" }, { result: "some markdown response" }]);
    expect(agent.getTextResponse(stdout)).toBe("some markdown response");
  });

  it("throws when result field is missing", () => {
    expect(() => agent.getTextResponse(JSON.stringify([]))).toThrow("missing 'result'");
  });
});
