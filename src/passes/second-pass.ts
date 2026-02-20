import { z } from "zod";
import { VerifiedIssue } from "../types.js";
import type { RawIssue, Config, RuleFile } from "../types.js";
import { runAgentWithRetry } from "../runner.js";

const SecondPassResponseSchema = z.discriminatedUnion("confirmed", [
  VerifiedIssue,
  z.object({ confirmed: z.literal(false) }),
]);

export function buildSecondPassPrompt(issue: RawIssue, rulesContent: string): string {
  return `You are an experienced code reviewer. Your task is to verify the rule violation found in the code.

FILE: ${issue.file}
LINE(S): ${issue.line}
VIOLATED RULE: ${issue.rule}
VIOLATION DESCRIPTION: ${issue.description}

Rules that have "Must" or "Have to" in it considered mandatory.
Rules with "Should" are recommendations.

RULES:
---
${rulesContent}
---

**Instructions**:
1. Read the specified file
2. Analyze whether the described violation actually exists

Return ONLY valid JSON:
If the violation is confirmed:
\`\`\`json
{
  "confirmed": true,
  "severity": "error" or "warning",
  "file": "path/to/file.ts",
  "line": "42",
  "rule": "rule name",
  "explanation": "detailed explanation of the violation and how to fix it (2-3 sentences)"
}
\`\`\`

If false positive:
\`\`\`json
{"confirmed": false}
\`\`\`

The "line" field can be a single line ("42") or a range ("20-45").`;
}

export async function executeSecondPass(
  ruleFile: RuleFile,
  issue: RawIssue,
  config: Config,
): Promise<VerifiedIssue | null> {
  const prompt = buildSecondPassPrompt(issue, ruleFile.content);
  const response = await runAgentWithRetry(
    config.agent,
    prompt,
    config.modelReview,
    ruleFile.dir,
    SecondPassResponseSchema,
    config.verbose,
    config.maxRetries,
  );
  return response.confirmed ? response : null;
}
