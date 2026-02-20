# AI Linter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that checks code against rules in `.ai-linter.md` files using Claude as AI backend (two-pass: Haiku scan → Sonnet verify).

**Architecture:** CLI finds `.ai-linter.md` files recursively, spawns parallel `claude -p` subprocesses for fast scanning, collects potential issues, then verifies each issue with a smarter model. Produces an MD report.

**Tech Stack:** TypeScript, Node.js, commander (CLI), child_process.spawn (claude -p), fast-glob (file discovery)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/types.ts`
- Create: `bin/ai-linter.js`

**Step 1: Initialize npm project**

Run: `npm init -y`

Then update `package.json`:

```json
{
  "name": "ai-linter",
  "version": "0.1.0",
  "description": "AI-powered code linter using Claude",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "ai-linter": "./bin/ai-linter.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "license": "MIT"
}
```

**Step 2: Install dependencies**

Run: `npm install commander fast-glob`
Run: `npm install -D typescript vitest @types/node`

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
ai-linter-report.md
```

**Step 5: Create bin/ai-linter.js**

```js
#!/usr/bin/env node
import "../dist/index.js";
```

**Step 6: Create src/types.ts**

```typescript
export interface RuleFile {
  /** Absolute path to .ai-linter.md */
  path: string;
  /** Directory containing the .ai-linter.md file */
  dir: string;
  /** Content of the file */
  content: string;
}

export interface RawIssue {
  file: string;
  line: string;
  severity: "error" | "warning";
  rule: string;
  description: string;
}

export interface FirstPassResult {
  ruleFile: RuleFile;
  issues: RawIssue[];
}

export interface VerifiedIssue {
  confirmed: true;
  severity: "error" | "warning";
  file: string;
  line: string;
  rule: string;
  explanation: string;
}

export interface RejectedIssue {
  confirmed: false;
}

export type SecondPassResult = VerifiedIssue | RejectedIssue;

export interface Config {
  projectPath: string;
  concurrency: number;
  modelFast: string;
  modelReview: string;
  outputPath: string;
  verbose: boolean;
}
```

**Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore bin/ai-linter.js src/types.ts
git commit -m "feat: project scaffolding with types"
```

---

### Task 2: Scanner — Find .ai-linter.md Files

**Files:**
- Create: `src/scanner.ts`
- Create: `src/__tests__/scanner.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/scanner.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { scanForRuleFiles } from "../scanner.js";

const TMP = join(import.meta.dirname, "../../.tmp-test-scanner");

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("scanForRuleFiles", () => {
  it("finds .ai-linter.md in root", async () => {
    writeFileSync(join(TMP, ".ai-linter.md"), "# Rules\nNo foo allowed");
    const results = await scanForRuleFiles(TMP);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("# Rules\nNo foo allowed");
    expect(results[0].dir).toBe(TMP);
  });

  it("finds .ai-linter.md in nested directories", async () => {
    writeFileSync(join(TMP, ".ai-linter.md"), "root rules");
    mkdirSync(join(TMP, "sub", "deep"), { recursive: true });
    writeFileSync(join(TMP, "sub", "deep", ".ai-linter.md"), "deep rules");
    const results = await scanForRuleFiles(TMP);
    expect(results).toHaveLength(2);
  });

  it("returns empty array when no rule files found", async () => {
    const results = await scanForRuleFiles(TMP);
    expect(results).toHaveLength(0);
  });

  it("skips node_modules", async () => {
    mkdirSync(join(TMP, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(TMP, "node_modules", "pkg", ".ai-linter.md"), "skip me");
    const results = await scanForRuleFiles(TMP);
    expect(results).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/scanner.test.ts`
Expected: FAIL — module `../scanner.js` not found

**Step 3: Write implementation**

Create `src/scanner.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/scanner.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add src/scanner.ts src/__tests__/scanner.test.ts
git commit -m "feat: scanner to find .ai-linter.md files"
```

---

### Task 3: Runner — Claude CLI Wrapper

**Files:**
- Create: `src/runner.ts`
- Create: `src/__tests__/runner.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/runner.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildClaudeArgs, parseClaudeResponse } from "../runner.js";

describe("buildClaudeArgs", () => {
  it("builds correct args for claude -p", () => {
    const args = buildClaudeArgs("check this code", "haiku");
    expect(args).toEqual([
      "-p", "check this code",
      "--model", "haiku",
      "--output-format", "json",
    ]);
  });
});

describe("parseClaudeResponse", () => {
  it("parses valid JSON from claude output", () => {
    const output = JSON.stringify({
      result: '{"issues": [{"file": "a.ts", "line": "1", "severity": "error", "rule": "no-foo", "description": "bad"}]}',
    });
    const result = parseClaudeResponse(output);
    expect(result).toEqual({
      issues: [{ file: "a.ts", line: "1", severity: "error", rule: "no-foo", description: "bad" }],
    });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseClaudeResponse("not json")).toThrow();
  });

  it("parses when result is already an object", () => {
    const output = JSON.stringify({
      result: { issues: [] },
    });
    const result = parseClaudeResponse(output);
    expect(result).toEqual({ issues: [] });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/runner.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/runner.ts`:

```typescript
import { spawn } from "node:child_process";

export function buildClaudeArgs(prompt: string, model: string): string[] {
  return ["-p", prompt, "--model", model, "--output-format", "json"];
}

export function parseClaudeResponse(stdout: string): unknown {
  const parsed = JSON.parse(stdout);
  const result = parsed.result;
  if (typeof result === "string") {
    return JSON.parse(result);
  }
  return result;
}

export async function runClaude(
  prompt: string,
  model: string,
  cwd: string,
): Promise<unknown> {
  const args = buildClaudeArgs(prompt, model);

  return new Promise((resolve, reject) => {
    const proc = spawn("claude", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(parseClaudeResponse(stdout));
      } catch (err) {
        reject(new Error(`Failed to parse claude response: ${stdout}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/runner.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add src/runner.ts src/__tests__/runner.test.ts
git commit -m "feat: claude CLI runner wrapper"
```

---

### Task 4: First Pass — Scan With Haiku

**Files:**
- Create: `src/passes/first-pass.ts`
- Create: `src/__tests__/first-pass.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/first-pass.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildFirstPassPrompt, parseFirstPassResponse } from "../passes/first-pass.js";

describe("buildFirstPassPrompt", () => {
  it("includes rules content in prompt", () => {
    const prompt = buildFirstPassPrompt("No foo library allowed");
    expect(prompt).toContain("No foo library allowed");
    expect(prompt).toContain("ПРАВИЛА:");
    expect(prompt).toContain('"issues"');
  });
});

describe("parseFirstPassResponse", () => {
  it("parses valid issues array", () => {
    const response = {
      issues: [
        { file: "a.ts", line: "10", severity: "error", rule: "no-foo", description: "bad" },
      ],
    };
    const issues = parseFirstPassResponse(response);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("returns empty array for no issues", () => {
    const issues = parseFirstPassResponse({ issues: [] });
    expect(issues).toHaveLength(0);
  });

  it("returns empty array for malformed response", () => {
    const issues = parseFirstPassResponse({ something: "else" });
    expect(issues).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/first-pass.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/passes/first-pass.ts`:

```typescript
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
      "line": "42" или "20-45",
      "severity": "error",
      "rule": "краткое название правила",
      "description": "что не так (1 предложение)"
    }
  ]
}

Если нарушений нет, верни: {"issues": []}`;
}

export function parseFirstPassResponse(response: unknown): RawIssue[] {
  if (
    typeof response === "object" &&
    response !== null &&
    "issues" in response &&
    Array.isArray((response as { issues: unknown }).issues)
  ) {
    return (response as { issues: RawIssue[] }).issues;
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/first-pass.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/passes/first-pass.ts src/__tests__/first-pass.test.ts
git commit -m "feat: first pass scanning logic"
```

---

### Task 5: Second Pass — Verify With Sonnet

**Files:**
- Create: `src/passes/second-pass.ts`
- Create: `src/__tests__/second-pass.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/second-pass.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSecondPassPrompt, parseSecondPassResponse } from "../passes/second-pass.js";

describe("buildSecondPassPrompt", () => {
  it("includes issue details in prompt", () => {
    const prompt = buildSecondPassPrompt({
      file: "src/a.ts",
      line: "10-20",
      severity: "error",
      rule: "no-foo",
      description: "Uses foo library",
    });
    expect(prompt).toContain("no-foo");
    expect(prompt).toContain("src/a.ts");
    expect(prompt).toContain("Uses foo library");
  });
});

describe("parseSecondPassResponse", () => {
  it("returns verified issue when confirmed", () => {
    const result = parseSecondPassResponse({
      confirmed: true,
      severity: "error",
      file: "a.ts",
      line: "10",
      rule: "no-foo",
      explanation: "The file imports foo which is banned.",
    });
    expect(result).not.toBeNull();
    expect(result!.confirmed).toBe(true);
  });

  it("returns null when not confirmed", () => {
    const result = parseSecondPassResponse({ confirmed: false });
    expect(result).toBeNull();
  });

  it("returns null for malformed response", () => {
    const result = parseSecondPassResponse({ random: "stuff" });
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/second-pass.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/passes/second-pass.ts`:

```typescript
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
  "severity": "error" | "warning",
  "file": "path/to/file.ts",
  "line": "42" или "20-45",
  "rule": "название правила",
  "explanation": "подробное объяснение проблемы и как её исправить (2-3 предложения)"
}
- Если ложное срабатывание:
{"confirmed": false}`;
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/second-pass.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/passes/second-pass.ts src/__tests__/second-pass.test.ts
git commit -m "feat: second pass verification logic"
```

---

### Task 6: Report Generator

**Files:**
- Create: `src/report.ts`
- Create: `src/__tests__/report.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/report.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateReport } from "../report.js";
import type { VerifiedIssue } from "../types.js";

describe("generateReport", () => {
  it("generates report with errors and warnings", () => {
    const issues: VerifiedIssue[] = [
      {
        confirmed: true,
        severity: "error",
        file: "src/a.ts",
        line: "10",
        rule: "no-foo",
        explanation: "Uses foo library which is banned.",
      },
      {
        confirmed: true,
        severity: "warning",
        file: "src/b.ts",
        line: "20-30",
        rule: "prefer-const",
        explanation: "Use const instead of let.",
      },
    ];
    const report = generateReport(issues, "/my/project");
    expect(report).toContain("# AI Linter Report");
    expect(report).toContain("1 error");
    expect(report).toContain("1 warning");
    expect(report).toContain("## Errors");
    expect(report).toContain("## Warnings");
    expect(report).toContain("`src/a.ts`");
    expect(report).toContain("**Строка 10**");
    expect(report).toContain("**Строки 20-30**");
    expect(report).toContain("[no-foo]");
    expect(report).toContain("[prefer-const]");
  });

  it("generates clean report when no issues", () => {
    const report = generateReport([], "/my/project");
    expect(report).toContain("# AI Linter Report");
    expect(report).toContain("0 errors, 0 warnings");
    expect(report).not.toContain("## Errors");
    expect(report).not.toContain("## Warnings");
  });

  it("formats single line and line ranges differently", () => {
    const issues: VerifiedIssue[] = [
      {
        confirmed: true,
        severity: "error",
        file: "x.ts",
        line: "5",
        rule: "r1",
        explanation: "Problem.",
      },
      {
        confirmed: true,
        severity: "error",
        file: "y.ts",
        line: "10-20",
        rule: "r2",
        explanation: "Another problem.",
      },
    ];
    const report = generateReport(issues, "/p");
    expect(report).toContain("**Строка 5**");
    expect(report).toContain("**Строки 10-20**");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/report.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/report.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/report.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/report.ts src/__tests__/report.test.ts
git commit -m "feat: markdown report generator"
```

---

### Task 7: CLI Entry Point — Wire Everything Together

**Files:**
- Create: `src/index.ts`

**Step 1: Write the CLI entry point**

Create `src/index.ts`:

```typescript
import { Command } from "commander";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { scanForRuleFiles } from "./scanner.js";
import { executeFirstPass } from "./passes/first-pass.js";
import { executeSecondPass } from "./passes/second-pass.js";
import { generateReport } from "./report.js";
import type { Config, RawIssue, VerifiedIssue } from "./types.js";

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

const program = new Command();

program
  .name("ai-linter")
  .description("AI-powered code linter using Claude")
  .version("0.1.0")
  .argument("[path]", "Project root to check", ".")
  .option("-c, --concurrency <n>", "Max parallel Claude sessions", "5")
  .option("--model-fast <model>", "Model for first pass", "haiku")
  .option("--model-review <model>", "Model for second pass", "sonnet")
  .option("-o, --output <path>", "Output report path", "ai-linter-report.md")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (pathArg: string, opts) => {
    const config: Config = {
      projectPath: resolve(pathArg),
      concurrency: parseInt(opts.concurrency, 10),
      modelFast: opts.modelFast,
      modelReview: opts.modelReview,
      outputPath: resolve(opts.output),
      verbose: opts.verbose,
    };

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
      const firstPassResults = await runWithConcurrency(
        ruleFiles,
        config.concurrency,
        async (rf) => {
          if (config.verbose) console.log(`  Scanning: ${rf.dir}`);
          return executeFirstPass(rf, config);
        },
      );

      const allRawIssues: { issue: RawIssue; cwd: string }[] = [];
      for (const result of firstPassResults) {
        for (const issue of result.issues) {
          allRawIssues.push({ issue, cwd: result.ruleFile.dir });
        }
      }

      console.log(
        `First pass complete. Found ${allRawIssues.length} potential issue(s).`,
      );

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

      const secondPassResults = await runWithConcurrency(
        allRawIssues,
        config.concurrency,
        async ({ issue, cwd }) => {
          if (config.verbose) console.log(`  Verifying: ${issue.file}:${issue.line}`);
          return executeSecondPass(issue, cwd, config);
        },
      );

      for (const result of secondPassResults) {
        if (result !== null) {
          verifiedIssues.push(result);
        }
      }

      console.log(
        `Second pass complete. ${verifiedIssues.length} issue(s) confirmed.`,
      );

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
```

**Step 2: Build and verify**

Run: `npx tsc`
Expected: No errors, `dist/` folder created

**Step 3: Test CLI help works**

Run: `node bin/ai-linter.js --help`
Expected: Shows usage with all flags

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: CLI entry point wiring all components together"
```

---

### Task 8: End-to-End Smoke Test

**Files:**
- Create: `e2e/test-project/.ai-linter.md`
- Create: `e2e/test-project/bad.ts`
- Create: `e2e/test-project/good.ts`

**Step 1: Create test fixture — rule file**

Create `e2e/test-project/.ai-linter.md`:

```markdown
# Rules

1. **ЗАПРЕЩЕНО** использовать `console.log` в production-коде
2. Все функции должны иметь явный return type
```

**Step 2: Create test fixture — bad code**

Create `e2e/test-project/bad.ts`:

```typescript
export function add(a: number, b: number) {
  console.log("adding", a, b);
  return a + b;
}
```

**Step 3: Create test fixture — good code**

Create `e2e/test-project/good.ts`:

```typescript
export function multiply(a: number, b: number): number {
  return a * b;
}
```

**Step 4: Run ai-linter against test project**

Run: `node bin/ai-linter.js e2e/test-project -o e2e/test-report.md -v`

Verify:
- Report file `e2e/test-report.md` is created
- Contains errors about `console.log` in `bad.ts`
- Contains error/warning about missing return type in `bad.ts`
- `good.ts` should have no issues (or only the return type is explicitly provided)

**Step 5: Add e2e fixtures to gitignore and commit**

Add `e2e/test-report.md` to `.gitignore`.

```bash
git add e2e/ .gitignore
git commit -m "test: add e2e smoke test fixtures"
```
