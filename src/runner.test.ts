import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { runAgentWithRetry } from "./runner.js";
import type { AgentAdapter } from "./agents.js";

function makeMockAgent(parseResult: unknown = {}): AgentAdapter {
  return {
    command: "mock",
    defaultFastModel: "fast",
    defaultReviewModel: "review",
    buildArgs: vi.fn().mockReturnValue([]),
    getJsonResponse: vi.fn().mockReturnValue(parseResult),
  };
}

describe("runAgentWithRetry", () => {
  const schema = z.object({ value: z.string() });

  it("returns parsed data when first attempt succeeds", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockResolvedValueOnce({ value: "ok" });
    const result = await runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, false, 3, executor);
    expect(result).toEqual({ value: "ok" });
  });

  it("retries and succeeds on second attempt", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockResolvedValueOnce({ wrong: "shape" }).mockResolvedValueOnce({ value: "ok" });
    const result = await runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, false, 3, executor);
    expect(result).toEqual({ value: "ok" });
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("throws after maxRetries failed attempts and includes Zod error", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockResolvedValue({ wrong: "shape" });
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, false, 3, executor)).rejects.toThrow(
      "Agent returned invalid response after 3 attempts",
    );
  });

  it("throws error message containing Zod issue details", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockResolvedValue({ wrong: "shape" });
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, false, 1, executor)).rejects.toThrow(
      "value",
    );
  });

  it("propagates executor errors immediately without retrying", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockRejectedValue(new Error("spawn failed"));
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, false, 3, executor)).rejects.toThrow(
      "spawn failed",
    );
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
