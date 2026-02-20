import { AgentAdapter, stripCodeFences } from "../agents.js";

export class ClaudeAgent extends AgentAdapter {
  command = "claude";
  defaultFastModel = "haiku";
  defaultReviewModel = "sonnet";

  buildArgs(prompt: string, model: string): string[] {
    return ["-p", prompt, "--model", model, "--output-format", "json"];
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
