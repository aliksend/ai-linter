import { AgentAdapter } from "../agents.js";

export class ClaudeAgent extends AgentAdapter {
  command = "claude";
  defaultFastModel = "haiku";
  defaultReviewModel = "sonnet";

  buildArgs(prompt: string, model: undefined | string): string[] {
    const args = ["-p", prompt, "--output-format", "json"];
    if (model) {
      args.push("--model", model);
    }
    return args;
  }

  getTextResponse(stdout: string): string {
    const parsed = JSON.parse(stdout);
    const result = parsed.result;
    if (result == null) {
      throw new Error(`Agent response missing 'result' field: ${stdout}`);
    }
    if (typeof result !== "string") {
      throw new Error(`Unknown result type: ${typeof result} (${result})`);
    }
    return result;
  }
}
