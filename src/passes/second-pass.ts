import { z } from "zod";
import { VerifiedIssue } from "../types.js";
import type { RawIssue, Config } from "../types.js";
import { runAgentWithRetry } from "../runner.js";

const SecondPassResponseSchema = z.discriminatedUnion("confirmed", [
  VerifiedIssue,
  z.object({ confirmed: z.literal(false) }),
]);

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
\`\`\`json
{
  "confirmed": true,
  "severity": "error" or "warning",
  "file": "path/to/file.ts",
  "line": "42",
  "rule": "rule name",
  "explanation": "detailed explanation of the problem and how to fix it (2-3 sentences)"
}
\`\`\`
- If false positive:
\`\`\`json
{"confirmed": false}
\`\`\`

The "line" field can be a single line ("42") or a range ("20-45").`;
}

export async function executeSecondPass(issue: RawIssue, cwd: string, config: Config): Promise<VerifiedIssue | null> {
  const prompt = buildSecondPassPrompt(issue);
  const response = await runAgentWithRetry(
    config.agent,
    prompt,
    config.modelReview,
    cwd,
    SecondPassResponseSchema,
    config.verbose,
  );
  return response.confirmed ? response : null;
}
