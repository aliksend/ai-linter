export interface AgentAdapter {
  /** Executable name, e.g. "claude" or "qwen" */
  command: string;
  /** Build CLI arguments for a one-shot prompt */
  buildArgs(prompt: string, model: string): string[];
  /** Parse raw stdout from the process into unknown (for Zod validation) */
  parseResponse(stdout: string): unknown;
}

export const AGENT_TYPES = ["claude", "qwen"] as const;
export type AgentType = typeof AGENT_TYPES[number];

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseJsonEnvelope(stdout: string): unknown {
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

export class ClaudeAgent implements AgentAdapter {
  command = "claude";

  buildArgs(prompt: string, model: string): string[] {
    return ["-p", prompt, "--model", model, "--output-format", "json"];
  }

  parseResponse(stdout: string): unknown {
    return parseJsonEnvelope(stdout);
  }
}

export class QwenAgent implements AgentAdapter {
  command = "qwen";

  buildArgs(prompt: string, model: string): string[] {
    return [prompt, "--model", model, "--output-format", "json"];
  }

  parseResponse(stdout: string): unknown {
    return parseJsonEnvelope(stdout);
  }
}

export function createAgent(type: AgentType): AgentAdapter {
  switch (type) {
    case "claude": return new ClaudeAgent();
    case "qwen":   return new QwenAgent();
  }
}
