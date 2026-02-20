import type { RawIssue, VerifiedIssue, Config } from "../types.js";
import { runClaude } from "../runner.js";

export function buildSecondPassPrompt(issue: RawIssue): string {
  return `Ты опытный ревьюер кода. Проверь, действительно ли это нарушение правил.

ПРАВИЛО: ${issue.rule}
ФАЙЛ: ${issue.file}
СТРОКА(И): ${issue.line}
ОПИСАНИЕ ПРОБЛЕМЫ: ${issue.description}

Инструкции:
1. Прочитай указанный файл
2. Проанализируй, действительно ли описанная проблема существует
3. Если это ложное срабатывание — верни {"confirmed": false}

Верни ТОЛЬКО валидный JSON:
- Если проблема подтверждена:
{
  "confirmed": true,
  "severity": "error" или "warning",
  "file": "path/to/file.ts",
  "line": "42",
  "rule": "название правила",
  "explanation": "подробное объяснение проблемы и как её исправить (2-3 предложения)"
}
- Если ложное срабатывание:
{"confirmed": false}

Поле "line" может быть одной строкой ("42") или диапазоном ("20-45").`;
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
