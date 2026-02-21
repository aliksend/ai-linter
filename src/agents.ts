export abstract class AgentAdapter {
  /** Executable name, e.g. "claude" or "qwen" */
  abstract command: string;
  /** Build CLI arguments for a one-shot prompt */
  abstract buildArgs(prompt: string, model: undefined | string): string[];
  /** Parse raw stdout from the process into the model's plain text response */
  abstract getTextResponse(stdout: string): string;

  defaultFastModel: undefined | string = undefined;
  defaultReviewModel: undefined | string = undefined;
}
