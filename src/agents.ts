export abstract class AgentAdapter {
  /** Executable name, e.g. "claude" or "qwen" */
  abstract command: string;
  /** Build CLI arguments for a one-shot prompt */
  abstract buildArgs(prompt: string, model: string): string[];
  /** Parse raw stdout from the process into unknown (for Zod validation) */
  abstract parseResponse(stdout: string): unknown;

  abstract defaultFastModel: string;
  abstract defaultReviewModel: string;
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseJsonEnvelope(stdout: string): unknown {
  const parsed = JSON.parse(stdout);
  const result = parsed.result;
  if (result === undefined || result === null) {
    throw new Error(`Agent response missing 'result' field: ${stdout}`);
  }
  if (typeof result === "string") {
    let resultStr = result;
    const fenceStart = resultStr.indexOf("```");
    if (fenceStart !== -1) {
      resultStr = resultStr.slice(fenceStart + 3).replace(/^json/, "");
    }
    resultStr = stripCodeFences(resultStr);
    return JSON.parse(resultStr);
  }
  return result;
}
