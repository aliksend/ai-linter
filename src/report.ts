import type { VerifiedIssue } from "./types.js";

function formatLine(line: string): string {
  return line.includes("-") ? `**Строки ${line}**` : `**Строка ${line}**`;
}

function formatIssuesByFile(issues: VerifiedIssue[]): string {
  const byFile = new Map<string, VerifiedIssue[]>();
  for (const issue of issues) {
    const list = byFile.get(issue.file) ?? [];
    list.push(issue);
    byFile.set(issue.file, list);
  }

  const sections: string[] = [];
  for (const [file, fileIssues] of byFile) {
    sections.push(`### \`${file}\`\n`);
    for (const issue of fileIssues) {
      sections.push(
        `- ${formatLine(issue.line)} — [${issue.rule}] ${issue.explanation}\n`,
      );
    }
  }
  return sections.join("\n");
}

export function generateReport(
  issues: VerifiedIssue[],
  projectPath: string,
): string {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const now = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  const errorWord = errors.length === 1 ? "error" : "errors";
  const warningWord = warnings.length === 1 ? "warning" : "warnings";

  const lines: string[] = [
    "# AI Linter Report",
    "",
    `**Дата:** ${now}`,
    `**Проект:** ${projectPath}`,
    `**Найдено:** ${errors.length} ${errorWord}, ${warnings.length} ${warningWord}`,
    "",
  ];

  if (errors.length > 0) {
    lines.push("---", "", `## Errors (${errors.length})`, "");
    lines.push(formatIssuesByFile(errors));
  }

  if (warnings.length > 0) {
    lines.push("---", "", `## Warnings (${warnings.length})`, "");
    lines.push(formatIssuesByFile(warnings));
  }

  return lines.join("\n");
}
