import type { Config, RuleFile } from "../types.js";
import { runAgentWithRetry } from "../runner.js";

export function buildSecondPassPrompt(issueSection: string, rulesContent: string): string {
  return `You are an experienced code reviewer. Your task is to verify the rule violation found in the code against the rules described below..
Rules that have "Must" or "Have to" in it considered mandatory.
Rules with "Should" are recommendations.

RULES:
---
${rulesContent}
---

REPORTED ISSUE:
---
${issueSection}
---

**Instructions**:
1. Read the file mentioned in the reported issue
2. Analyze whether the described violation actually exists

If the violation IS confirmed, respond with a markdown section:
\`\`\`markdown
# [rule name]: [brief description]

- **File**: path/to/file.ts
- **Line**: 42 (or 20-45 for a range)
- **Severity**: error (or warning)
- **Explanation**: detailed explanation of the violation and how to fix it (2-3 sentences)
\`\`\`

If the violation is NOT confirmed (false positive), respond with "False positive."`;
}

export function parseSecondPassSection(text: string): string | null {
  const idx = text.search(/^# /m);
  if (idx === -1) return null;
  return text.slice(idx).trim();
}

export async function executeSecondPass(
  ruleFile: RuleFile,
  issueSection: string,
  config: Config,
): Promise<string | null> {
  const prompt = buildSecondPassPrompt(issueSection, ruleFile.content);
  const text = await runAgentWithRetry(
    config.agent,
    prompt,
    config.modelReview,
    ruleFile.dir,
    config.verbose,
    config.maxRetries,
  );
  return parseSecondPassSection(text);
}
