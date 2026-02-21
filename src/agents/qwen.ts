import { AgentAdapter } from "../agents.js";

export class QwenAgent extends AgentAdapter {
  command = "qwen";

  buildArgs(prompt: string, model: undefined | string): string[] {
    const args = [prompt, "--output-format", "json"];
    if (model) {
      args.push("--model", model);
    }
    return args;
  }

  getTextResponse(stdout: string): string {
    const parsedRes = JSON.parse(stdout);
    const parsed = parsedRes[parsedRes.length - 1];
    const result = parsed?.result;
    if (result == null) {
      throw new Error(`Agent response missing 'result' field: ${stdout}`);
    }
    if (typeof result !== "string") {
      throw new Error(`Unknown result type: ${typeof result} (${result})`);
    }
    return result;
  }
}
