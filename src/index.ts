import { Command } from "commander";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { scanForRuleFiles } from "./scanner.js";
import { executeFirstPass } from "./passes/first-pass.js";
import { executeSecondPass } from "./passes/second-pass.js";
import { generateReport } from "./report.js";
import { AGENT_TYPES, AgentType, Config, type RawIssue, type VerifiedIssue } from "./types.js";
import type { AgentAdapter } from "./agents.js";
import { ClaudeAgent } from "./agents/claude.js";
import { QwenAgent } from "./agents/qwen.js";

async function runWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function createAgent(type: AgentType): AgentAdapter {
  switch (type) {
    case "claude":
      return new ClaudeAgent();
    case "qwen":
      return new QwenAgent();
  }
}

const program = new Command();

program
  .name("ai-linter")
  .description("AI-powered code linter")
  .version("0.1.0")
  .argument("[path]", "Project root to check", ".")
  .option("-c, --concurrency <n>", "Max parallel agent sessions", "5")
  .option("--model-fast <model>", "Model for first pass")
  .option("--model-review <model>", "Model for second pass")
  .option("--agent <type>", "AI agent to use: claude or qwen", "claude")
  .option("-o, --output <path>", "Output report path", "ai-linter-report.md")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (pathArg: string, opts) => {
    const concurrency = parseInt(opts.concurrency, 10);
    if (!Number.isFinite(concurrency) || concurrency < 1) {
      console.error(`Error: --concurrency must be a positive integer, got: ${opts.concurrency}`);
      process.exit(2);
    }

    const agentType = opts.agent as string;
    if (!(AGENT_TYPES as readonly string[]).includes(agentType)) {
      console.error(`Error: --agent must be one of: ${AGENT_TYPES.join(", ")}, got: ${agentType}`);
      process.exit(2);
    }

    const agent = createAgent(agentType as AgentType);

    const config = Config.parse({
      projectPath: resolve(pathArg),
      concurrency,
      modelFast: opts.modelFast ?? agent.defaultFastModel,
      modelReview: opts.modelReview ?? agent.defaultReviewModel,
      outputPath: resolve(opts.output),
      verbose: opts.verbose,
      agent,
    });

    try {
      // Step 1: Find rule files
      console.log(`Scanning for .ai-linter.md files in ${config.projectPath}...`);
      const ruleFiles = await scanForRuleFiles(config.projectPath);

      if (ruleFiles.length === 0) {
        console.log("No .ai-linter.md files found. Nothing to check.");
        process.exit(0);
      }

      console.log(`Found ${ruleFiles.length} rule file(s). Starting first pass...`);

      // Step 2: First pass — parallel scan
      const firstPassResults = await runWithConcurrency(ruleFiles, config.concurrency, async (rf) => {
        console.log(`  Scanning: ${rf.dir}`);
        return executeFirstPass(rf, config);
      });

      const allRawIssues: { issue: RawIssue; cwd: string }[] = [];
      for (const result of firstPassResults) {
        for (const issue of result.issues) {
          allRawIssues.push({ issue, cwd: result.ruleFile.dir });
        }
      }

      console.log(`First pass complete. Found ${allRawIssues.length} potential issue(s).`);

      if (allRawIssues.length === 0) {
        console.log("No issues found. Code looks clean!");
        const report = generateReport([], config.projectPath);
        await writeFile(config.outputPath, report, "utf-8");
        console.log(`Report saved to ${config.outputPath}`);
        process.exit(0);
      }

      // Step 3: Second pass — verify each issue
      console.log("Starting second pass (verification)...");
      const verifiedIssues: VerifiedIssue[] = [];

      const secondPassResults = await runWithConcurrency(allRawIssues, config.concurrency, async ({ issue, cwd }) => {
        console.log(`  Verifying: ${issue.file}:${issue.line}`);
        return executeSecondPass(issue, cwd, config);
      });

      for (const result of secondPassResults) {
        if (result !== null) {
          verifiedIssues.push(result);
        }
      }

      console.log(`Second pass complete. ${verifiedIssues.length} issue(s) confirmed.`);

      // Step 4: Generate report
      const report = generateReport(verifiedIssues, config.projectPath);
      await writeFile(config.outputPath, report, "utf-8");
      console.log(`Report saved to ${config.outputPath}`);

      // Step 5: Exit code
      const hasErrors = verifiedIssues.some((i) => i.severity === "error");
      process.exit(hasErrors ? 1 : 0);
    } catch (err) {
      console.error("ai-linter error:", err);
      process.exit(2);
    }
  });

program.parse();
