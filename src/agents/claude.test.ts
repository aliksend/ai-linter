import { describe, it, expect } from "vitest";
import { ClaudeAgent } from "./claude.js";

describe("ClaudeAgent", () => {
  const agent = new ClaudeAgent();

  it("has correct command", () => {
    expect(agent.command).toBe("claude");
  });

  it("builds correct args with provided model", () => {
    expect(agent.buildArgs("my prompt", "haiku")).toEqual([
      "-p",
      "my prompt",
      "--output-format",
      "json",
      "--model",
      "haiku",
    ]);
  });

  it("builds correct args without provided model", () => {
    expect(agent.buildArgs("my prompt", undefined)).toEqual(["-p", "my prompt", "--output-format", "json"]);
  });

  it("returns plain text from result field", () => {
    const stdout = JSON.stringify({ result: "some markdown response" });
    expect(agent.getTextResponse(stdout)).toBe("some markdown response");
  });

  it("throws when result field is missing", () => {
    expect(() => agent.getTextResponse(JSON.stringify({}))).toThrow("missing 'result'");
  });
});
