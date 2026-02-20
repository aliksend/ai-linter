import type { RawIssue, VerifiedIssue, Config } from "../types.js";
import { runClaude } from "../runner.js";

export function buildSecondPassPrompt(issue: RawIssue): string {
  return `You are an experienced code reviewer. Verify whether this is actually a rule violation.

RULE: ${issue.rule}
FILE: ${issue.file}
LINE(S): ${issue.line}
PROBLEM DESCRIPTION: ${issue.description}

Instructions:
1. Read the specified file
2. Analyze whether the described problem actually exists
3. If this is a false positive — return {"confirmed": false}

Return ONLY valid JSON:
- If the problem is confirmed:
{
  "confirmed": true,
  "severity": "error" or "warning",
  "file": "path/to/file.ts",
  "line": "42",
  "rule": "rule name",
  "explanation": "detailed explanation of the problem and how to fix it (2-3 sentences)"
}
- If false positive:
{"confirmed": false}

The "line" field can be a single line ("42") or a range ("20-45").`;
}

function isVerifiedIssue(obj: unknown): obj is VerifiedIssue {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    o.confirmed === true &&
    (o.severity === "error" || o.severity === "warning") &&
    typeof o.file === "string" &&
    typeof o.line === "string" &&
    typeof o.rule === "string" &&
    typeof o.explanation === "string"
  );
}

export function parseSecondPassResponse(response: unknown): VerifiedIssue | null {
  if (!isVerifiedIssue(response)) return null;
  return response;
}

export async function executeSecondPass(
  issue: RawIssue,
  cwd: string,
  config: Config,
): Promise<VerifiedIssue | null> {
  const prompt = buildSecondPassPrompt(issue);
  const response = await runClaude(prompt, config.modelReview, cwd);
  return parseSecondPassResponse(response);
}
