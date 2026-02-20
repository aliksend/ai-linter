import { AgentAdapter, stripCodeFences } from "../agents.js";

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

  getJsonResponse(stdout: string): string {
    const parsed = JSON.parse(stdout);
    let result = parsed.result;
    if (result == null) {
      throw new Error(`Agent response missing 'result' field: ${stdout}`);
    }
    if (typeof result !== "string") {
      throw new Error(`Unknown result type: ${typeof result} (${result})`);
    }

    const fenceStart = result.indexOf("```");
    if (fenceStart !== -1) {
      result = result.slice(fenceStart + 3).replace(/^json/, "");
    }
    return stripCodeFences(result);
  }
}
