import { AgentAdapter, parseJsonEnvelope } from "../agents.js";

export class QwenAgent implements AgentAdapter {
  command = "qwen";

  buildArgs(prompt: string, model: string): string[] {
    return [prompt, "--model", model, "--output-format", "json"];
  }

  parseResponse(stdout: string): unknown {
    return parseJsonEnvelope(stdout);
  }
}
