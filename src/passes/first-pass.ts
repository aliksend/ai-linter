import type { RawIssue, RuleFile, FirstPassResult, Config } from "../types.js";
import { runClaude } from "../runner.js";

export function buildFirstPassPrompt(rulesContent: string): string {
  return `Ты AI-линтер. Твоя задача — проверить код в текущей директории на соответствие правилам, описанным ниже.

ПРАВИЛА:
---
${rulesContent}
---

Инструкции:
1. Изучи файлы в текущей директории и вложенных папках
2. Проверь код на соответствие каждому правилу
3. Для каждого нарушения определи severity:
   - "error" — явное нарушение запрета или обязательного требования
   - "warning" — нарушение рекомендации или потенциальная проблема

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": "42",
      "severity": "error",
      "rule": "краткое название правила",
      "description": "что не так (1 предложение)"
    }
  ]
}

Поле "line" может быть одной строкой ("42") или диапазоном ("20-45").

Если нарушений нет, верни: {"issues": []}`;
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
