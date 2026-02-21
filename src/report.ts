export function generateReport(confirmedSections: string[]): string {
  const issueWord = confirmedSections.length === 1 ? "issue" : "issues";

  const lines: string[] = [
    "# AI Linter Report",
    "",
    `**Date:** ${new Date().toLocaleString()}`,
    `**Found:** ${confirmedSections.length} confirmed ${issueWord}`,
    "",
  ];

  for (const section of confirmedSections) {
    lines.push("---", "", section, "");
  }

  return lines.join("\n");
}
