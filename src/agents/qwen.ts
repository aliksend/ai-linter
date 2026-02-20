import { AgentAdapter, stripCodeFences } from "../agents.js";

export class QwenAgent extends AgentAdapter {
  command = "qwen";
  defaultFastModel = "qwen3-coder";
  defaultReviewModel = "qwen3-coder";

  buildArgs(prompt: string, model: string): string[] {
    return [prompt, "--model", model, "--output-format", "json"];
  }

  getJsonResponse(stdout: string): string {
    let parsedRes = JSON.parse(stdout);
    let parsed = parsedRes[parsedRes.length - 1];
    let result = parsed?.result;
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
