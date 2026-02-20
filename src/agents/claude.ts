import { AgentAdapter, parseJsonEnvelope } from "../agents.js";

export class ClaudeAgent implements AgentAdapter {
  command = "claude";

  buildArgs(prompt: string, model: string): string[] {
    return ["-p", prompt, "--model", model, "--output-format", "json"];
  }

  parseResponse(stdout: string): unknown {
    return parseJsonEnvelope(stdout);
  }
}
