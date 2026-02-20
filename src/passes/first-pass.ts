import { z } from "zod";
import { RawIssue } from "../types.js";
import type { RuleFile, FirstPassResult, Config } from "../types.js";
import { runAgentWithRetry } from "../runner.js";

const FirstPassResponseSchema = z.object({
  issues: z.array(RawIssue),
});

export function buildFirstPassPrompt(rulesContent: string): string {
  return `You are an AI linter. Your task is to check the code in the current directory against the rules described below.
Rules that have "Must" or "Have to" in it considered mandatory.
Rules with "Should" are recommendations.
If you are unsure whether it is a violation or not, report it as a violation.

RULES:
---
${rulesContent}
---

**Instructions**:
1. Examine files in the current directory and subdirectories
2. Check the code against each rule
3. For each violation, determine the severity:
   - "error" — explicit violation of a prohibition or mandatory requirement
   - "warning" — violation of a recommendation or potential issue

Return ONLY valid JSON:
\`\`\`json
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
\`\`\`

The "line" field can be a single line ("42") or a range ("20-45").

If there are no violations, return:

\`\`\`json
{"issues": []}
\`\`\`

`;
}

export async function executeFirstPass(ruleFile: RuleFile, config: Config): Promise<FirstPassResult> {
  const prompt = buildFirstPassPrompt(ruleFile.content);
  const response = await runAgentWithRetry(
    config.agent,
    prompt,
    config.modelFast,
    ruleFile.dir,
    FirstPassResponseSchema,
    config.verbose,
    config.maxRetries,
  );
  return { ruleFile, issues: response.issues };
}
