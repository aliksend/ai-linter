import type { RawIssue, RuleFile, FirstPassResult, Config } from "../types.js";
import { runClaude } from "../runner.js";

export function buildFirstPassPrompt(rulesContent: string): string {
  return `You are an AI linter. Your task is to check the code in the current directory against the rules described below.

RULES:
---
${rulesContent}
---

Instructions:
1. Examine files in the current directory and subdirectories
2. Check the code against each rule
3. For each violation, determine the severity:
   - "error" — explicit violation of a prohibition or mandatory requirement
   - "warning" — violation of a recommendation or potential issue

Return ONLY valid JSON (no markdown):
{
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": "42",
      "severity": "error",
      "rule": "short rule name",
      "description": "what is wrong (1 sentence)"
    }
  ]
}

The "line" field can be a single line ("42") or a range ("20-45").

If there are no violations, return: {"issues": []}`;
}

function isRawIssue(item: unknown): item is RawIssue {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.file === "string" &&
    typeof obj.line === "string" &&
    (obj.severity === "error" || obj.severity === "warning") &&
    typeof obj.rule === "string" &&
    typeof obj.description === "string"
  );
}

export function parseFirstPassResponse(response: unknown): RawIssue[] {
  if (
    typeof response === "object" &&
    response !== null &&
    "issues" in response &&
    Array.isArray((response as { issues: unknown }).issues)
  ) {
    return (response as { issues: unknown[] }).issues.filter(isRawIssue);
  }
  return [];
}

export async function executeFirstPass(
  ruleFile: RuleFile,
  config: Config,
): Promise<FirstPassResult> {
  const prompt = buildFirstPassPrompt(ruleFile.content);
  const response = await runClaude(prompt, config.modelFast, ruleFile.dir);
  const issues = parseFirstPassResponse(response);
  return { ruleFile, issues };
}
