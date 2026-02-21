import { describe, it, expect, vi } from "vitest";
import { runAgentWithRetry } from "./runner.js";
import type { AgentAdapter } from "./agents.js";

function makeMockAgent(): AgentAdapter {
  return {
    command: "mock",
    defaultFastModel: "fast",
    defaultReviewModel: "review",
    buildArgs: vi.fn().mockReturnValue([]),
    getTextResponse: vi.fn().mockReturnValue(""),
  };
}

describe("runAgentWithRetry", () => {
  it("returns text when first attempt succeeds", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockResolvedValueOnce("result text");
    const result = await runAgentWithRetry(agent, "prompt", "model", "/cwd", false, 3, executor);
    expect(result).toBe("result text");
  });

  it("retries and succeeds on second attempt", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce("ok");
    const result = await runAgentWithRetry(agent, "prompt", "model", "/cwd", false, 3, executor);
    expect(result).toBe("ok");
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("throws after maxRetries failed attempts", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockRejectedValue(new Error("spawn failed"));
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", false, 3, executor)).rejects.toThrow(
      "Agent returned invalid response after 3 attempts",
    );
  });

  it("includes original error in message", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockRejectedValue(new Error("spawn failed"));
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", false, 1, executor)).rejects.toThrow(
      "spawn failed",
    );
  });

  it("retries exactly maxRetries times", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", false, 3, executor)).rejects.toThrow();
    expect(executor).toHaveBeenCalledTimes(3);
  });
});
