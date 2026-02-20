export abstract class AgentAdapter {
  /** Executable name, e.g. "claude" or "qwen" */
  abstract command: string;
  /** Build CLI arguments for a one-shot prompt */
  abstract buildArgs(prompt: string, model: undefined | string): string[];
  /** Parse raw stdout from the process into unknown (for Zod validation) */
  abstract getJsonResponse(stdout: string): string;

  abstract defaultFastModel: undefined | string;
  abstract defaultReviewModel: undefined | string;
}

export function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}
