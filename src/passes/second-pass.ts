import type { RawIssue, VerifiedIssue, Config } from "../types.js";
import { runClaude } from "../runner.js";

export function buildSecondPassPrompt(issue: RawIssue): string {
  return `Ты опытный ревьюер кода. Проверь, действительно ли это нарушение правил.

ПРАВИЛО: ${issue.rule}
ФАЙЛ: ${issue.file}
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

export function parseSecondPassResponse(response: unknown): VerifiedIssue | null {
  if (typeof response !== "object" || response === null) return null;
  const obj = response as Record<string, unknown>;
  if (obj.confirmed !== true) return null;
  return response as VerifiedIssue;
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
