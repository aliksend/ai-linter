import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { RuleFile } from "./types.js";

export async function scanForRuleFiles(projectPath: string): Promise<RuleFile[]> {
  const pattern = "**/.ai-linter.md";
  const paths = await fg(pattern, {
    cwd: projectPath,
    absolute: true,
    dot: true,
    ignore: ["**/node_modules/**"],
  });

  const ruleFiles: RuleFile[] = [];
  for (const filePath of paths) {
    const content = await readFile(filePath, "utf-8");
    ruleFiles.push({
      path: filePath,
      dir: dirname(filePath),
      content,
    });
  }

  return ruleFiles;
}
