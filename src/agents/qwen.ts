import { AgentAdapter, parseJsonEnvelope } from "../agents.js";

export class QwenAgent extends AgentAdapter {
  command = "qwen";
  defaultFastModel = "qwen3-coder";
  defaultReviewModel = "qwen3-coder";

  buildArgs(prompt: string, model: string): string[] {
    return [prompt, "--model", model, "--output-format", "json"];
  }

  parseResponse(stdout: string): unknown {
    return parseJsonEnvelope(stdout);
  }
}
