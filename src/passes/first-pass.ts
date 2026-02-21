import type { RuleFile, FirstPassResult, Config } from "../types.js";
import { runAgentWithRetry } from "../runner.js";

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
3. For each violation, write a section starting with "# " on its own line

Suggested format for each section:
\`\`\`markdown
# [short rule name]: [brief description]

- **File**: path/to/file.ts
- **Line**: 42 (or 20-45 for a range)
- **Severity**: error (or warning)
- **Description**: what is wrong (1-2 sentences)
\`\`\`

Use "error" severity for explicit violations of prohibitions or mandatory requirements.
Use "warning" severity for violations of recommendations or potential issues.

Each issue must be a separate section. If there are no violations, respond with "No issues found."
`;
}

export function parseFirstPassSections(text: string): string[] {
  return text
    .split(/^(?=# )/m)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("# ") && s.length > 2);
}

export async function executeFirstPass(ruleFile: RuleFile, config: Config): Promise<FirstPassResult> {
  const prompt = buildFirstPassPrompt(ruleFile.content);
  const text = await runAgentWithRetry(
    config.agent,
    prompt,
    config.modelFast,
    ruleFile.dir,
    config.verbose,
    config.maxRetries,
  );
  const sections = parseFirstPassSections(text);
  return { ruleFile, sections };
}
