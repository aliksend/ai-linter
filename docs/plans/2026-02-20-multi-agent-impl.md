# Multi-Agent Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded Claude subprocess calls with a pluggable `AgentAdapter` interface, add `ClaudeAgent` and `QwenAgent` implementations, and expose `--agent` CLI option.

**Architecture:** A new `src/agents.ts` defines the `AgentAdapter` interface and two class implementations. `runner.ts` is stripped of Claude-specific logic and exposes `runAgentWithRetry(agent, ...)`. The agent is instantiated in `index.ts` and flows through `Config` into both passes.

**Tech Stack:** TypeScript, Vitest (tests), Commander (CLI), Zod (schema validation), Node `child_process.spawn`.

---

### Task 1: Create `src/agents.ts` with interface, ClaudeAgent, QwenAgent, createAgent

**Files:**
- Create: `src/agents.ts`
- Create: `src/__tests__/agents.test.ts`

**Step 1: Write failing tests**

Create `src/__tests__/agents.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ClaudeAgent, QwenAgent, createAgent } from "../agents.js";

describe("ClaudeAgent", () => {
  const agent = new ClaudeAgent();

  it("has correct command", () => {
    expect(agent.command).toBe("claude");
  });

  it("builds correct args", () => {
    expect(agent.buildArgs("my prompt", "haiku")).toEqual([
      "-p", "my prompt", "--model", "haiku", "--output-format", "json",
    ]);
  });

  it("parses valid JSON result string", () => {
    const stdout = JSON.stringify({ result: '{"issues":[]}' });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("parses result already an object", () => {
    const stdout = JSON.stringify({ result: { issues: [] } });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("parses result wrapped in markdown fences", () => {
    const stdout = JSON.stringify({ result: "```json\n{\"issues\":[]}\n```" });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("parses result with text prefix before fences", () => {
    const stdout = JSON.stringify({
      result: "Here are the results:\n\n```json\n{\"issues\":[]}\n```",
    });
    expect(agent.parseResponse(stdout)).toEqual({ issues: [] });
  });

  it("throws when result field is missing", () => {
    expect(() => agent.parseResponse(JSON.stringify({}))).toThrow("missing 'result'");
  });
});

describe("QwenAgent", () => {
  const agent = new QwenAgent();

  it("has correct command", () => {
    expect(agent.command).toBe("qwen");
  });

  it("builds args with prompt as positional", () => {
    expect(agent.buildArgs("my prompt", "qwen-max")).toEqual([
      "my prompt", "--model", "qwen-max", "--output-format", "json",
    ]);
  });
});

describe("createAgent", () => {
  it("returns ClaudeAgent for 'claude'", () => {
    expect(createAgent("claude")).toBeInstanceOf(ClaudeAgent);
  });

  it("returns QwenAgent for 'qwen'", () => {
    expect(createAgent("qwen")).toBeInstanceOf(QwenAgent);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- agents
```

Expected: FAIL — modules not found.

**Step 3: Implement `src/agents.ts`**

```typescript
export interface AgentAdapter {
  /** Executable name, e.g. "claude" or "qwen" */
  command: string;
  /** Build CLI arguments for a one-shot prompt */
  buildArgs(prompt: string, model: string): string[];
  /** Parse raw stdout from the process into unknown (for Zod validation) */
  parseResponse(stdout: string): unknown;
}

export type AgentType = "claude" | "qwen";

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseJsonEnvelope(stdout: string): unknown {
  const parsed = JSON.parse(stdout);
  const result = parsed.result;
  if (result === undefined || result === null) {
    throw new Error(`Agent response missing 'result' field: ${stdout}`);
  }
  if (typeof result === "string") {
    let resultStr = result;
    const fenceStart = resultStr.indexOf("```");
    if (fenceStart !== -1) {
      resultStr = resultStr.slice(fenceStart + 3).replace(/^json/, "");
    }
    resultStr = stripCodeFences(resultStr);
    return JSON.parse(resultStr);
  }
  return result;
}

export class ClaudeAgent implements AgentAdapter {
  command = "claude";

  buildArgs(prompt: string, model: string): string[] {
    return ["-p", prompt, "--model", model, "--output-format", "json"];
  }

  parseResponse(stdout: string): unknown {
    return parseJsonEnvelope(stdout);
  }
}

export class QwenAgent implements AgentAdapter {
  command = "qwen";

  buildArgs(prompt: string, model: string): string[] {
    return [prompt, "--model", model, "--output-format", "json"];
  }

  parseResponse(stdout: string): unknown {
    return parseJsonEnvelope(stdout);
  }
}

export function createAgent(type: AgentType): AgentAdapter {
  switch (type) {
    case "claude": return new ClaudeAgent();
    case "qwen":   return new QwenAgent();
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- agents
```

Expected: all PASS.

**Step 5: Commit**

```bash
git add src/agents.ts src/__tests__/agents.test.ts
git commit -m "feat: add AgentAdapter interface with ClaudeAgent and QwenAgent"
```

---

### Task 2: Refactor `src/runner.ts` — remove Claude-specific code, add `runAgentWithRetry`

**Files:**
- Modify: `src/__tests__/runner.test.ts`
- Modify: `src/runner.ts`

**Step 1: Rewrite `src/__tests__/runner.test.ts`**

The old tests for `buildClaudeArgs` and `parseClaudeResponse` are now covered by `agents.test.ts`. Replace the file:

```typescript
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { runAgentWithRetry } from "../runner.js";
import type { AgentAdapter } from "../agents.js";

function makeMockAgent(parseResult: unknown = {}): AgentAdapter {
  return {
    command: "mock",
    buildArgs: vi.fn().mockReturnValue([]),
    parseResponse: vi.fn().mockReturnValue(parseResult),
  };
}

describe("runAgentWithRetry", () => {
  const schema = z.object({ value: z.string() });

  it("returns parsed data when first attempt succeeds", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockResolvedValueOnce({ value: "ok" });
    const result = await runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, 3, executor);
    expect(result).toEqual({ value: "ok" });
  });

  it("retries and succeeds on second attempt", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn()
      .mockResolvedValueOnce({ wrong: "shape" })
      .mockResolvedValueOnce({ value: "ok" });
    const result = await runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, 3, executor);
    expect(result).toEqual({ value: "ok" });
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("throws after maxRetries failed attempts and includes Zod error", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockResolvedValue({ wrong: "shape" });
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, 3, executor))
      .rejects.toThrow("Agent returned invalid response after 3 attempts");
  });

  it("throws error message containing Zod issue details", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockResolvedValue({ wrong: "shape" });
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, 1, executor))
      .rejects.toThrow("value");
  });

  it("propagates executor errors immediately without retrying", async () => {
    const agent = makeMockAgent();
    const executor = vi.fn().mockRejectedValue(new Error("spawn failed"));
    await expect(runAgentWithRetry(agent, "prompt", "model", "/cwd", schema, 3, executor))
      .rejects.toThrow("spawn failed");
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- runner
```

Expected: FAIL — `runAgentWithRetry` not found.

**Step 3: Rewrite `src/runner.ts`**

```typescript
import { spawn } from "node:child_process";
import { z, ZodError } from "zod";
import type { AgentAdapter } from "./agents.js";

export async function runAgent(
  agent: AgentAdapter,
  prompt: string,
  model: string,
  cwd: string,
): Promise<unknown> {
  const args = agent.buildArgs(prompt, model);

  return new Promise((resolve, reject) => {
    const proc = spawn(agent.command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`${agent.command} exited with code ${code ?? "null (signal)"}: ${stderr}`));
        return;
      }
      try {
        resolve(agent.parseResponse(stdout));
      } catch (err) {
        reject(new Error(
          `Failed to parse ${agent.command} response: ${err instanceof Error ? err.message : err}\n` +
          `Raw output:\n${stdout}`,
        ));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ${agent.command}: ${err.message}`));
    });
  });
}

export async function runAgentWithRetry<T>(
  agent: AgentAdapter,
  prompt: string,
  model: string,
  cwd: string,
  schema: z.ZodType<T>,
  maxRetries = 3,
  executor: (agent: AgentAdapter, prompt: string, model: string, cwd: string) => Promise<unknown> = runAgent,
): Promise<T> {
  let lastError: ZodError | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await executor(agent, prompt, model, cwd);
    const result = schema.safeParse(response);
    if (result.success) return result.data;
    lastError = result.error;
  }
  throw new Error(
    `Agent returned invalid response after ${maxRetries} attempts.\n` +
    `Zod error: ${JSON.stringify(lastError?.issues, null, 2)}`,
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- runner
```

Expected: all PASS.

**Step 5: Run full test suite**

```bash
npm test
```

Expected: all PASS (agents + runner pass; first-pass and second-pass tests may fail due to import of old `runClaudeWithRetry` — fix in Task 3).

**Step 6: Commit**

```bash
git add src/runner.ts src/__tests__/runner.test.ts
git commit -m "refactor: replace runClaudeWithRetry with runAgentWithRetry accepting AgentAdapter"
```

---

### Task 3: Update `src/types.ts` — add `agent` field to `Config`

**Files:**
- Modify: `src/types.ts`

**Step 1: Add `agent` to `Config`**

In `src/types.ts`, add the import and field:

```typescript
import type { AgentAdapter } from "./agents.js";

export interface Config {
  projectPath: string;
  concurrency: number;
  modelFast: string;
  modelReview: string;
  outputPath: string;
  verbose: boolean;
  agent: AgentAdapter;
}
```

**Step 2: Run full test suite**

```bash
npm test
```

Expected: TypeScript errors in tests that construct `Config` objects (first-pass.test.ts, second-pass.test.ts). Fix them by adding `agent: new ClaudeAgent()` to any `Config` literals in those test files. No logic changes needed.

Check `src/__tests__/first-pass.test.ts`:

```typescript
import { ClaudeAgent } from "../agents.js";
// in the config object used in tests:
agent: new ClaudeAgent(),
```

Check `src/__tests__/second-pass.test.ts` the same way.

**Step 3: Run full test suite again**

```bash
npm test
```

Expected: all PASS.

**Step 4: Commit**

```bash
git add src/types.ts src/__tests__/first-pass.test.ts src/__tests__/second-pass.test.ts
git commit -m "feat: add agent field to Config type"
```

---

### Task 4: Update passes to use `runAgentWithRetry`

**Files:**
- Modify: `src/passes/first-pass.ts`
- Modify: `src/passes/second-pass.ts`

**Step 1: Update `src/passes/first-pass.ts`**

Change the import and the call:

```typescript
import { runAgentWithRetry } from "../runner.js";
// ...
const response = await runAgentWithRetry(config.agent, prompt, config.modelFast, ruleFile.dir, FirstPassResponseSchema);
```

Full file after change:

```typescript
import { z } from "zod";
import { RawIssue } from "../types.js";
import type { RuleFile, FirstPassResult, Config } from "../types.js";
import { runAgentWithRetry } from "../runner.js";

const FirstPassResponseSchema = z.object({
  issues: z.array(RawIssue),
});

export function buildFirstPassPrompt(rulesContent: string): string {
  return `You are an AI linter. Your task is to check the code in the current directory against the rules described below.
Rules that have "Must" or "Have to" in it considered mandatory.
Rules with "Should" are recommendations.

RULES:
---
${rulesContent}
---

Instructions:
1. Examine files in the current directory and subdirectories
2. Check the code against each rule
3. For each violation, determine the severity:
   - "error" — explicit violation of a prohibition or mandatory requirement
   - "warning" — violation of a recommendation or potential issue

Return ONLY valid JSON (no markdown):
{
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": "42",
      "severity": "error",
      "rule": "short rule name",
      "description": "what is wrong (1 sentence)"
    }
  ]
}

The "line" field can be a single line ("42") or a range ("20-45").

If there are no violations, return: {"issues": []}`;
}

export async function executeFirstPass(ruleFile: RuleFile, config: Config): Promise<FirstPassResult> {
  const prompt = buildFirstPassPrompt(ruleFile.content);
  const response = await runAgentWithRetry(config.agent, prompt, config.modelFast, ruleFile.dir, FirstPassResponseSchema);
  return { ruleFile, issues: response.issues };
}
```

**Step 2: Update `src/passes/second-pass.ts`**

```typescript
import { z } from "zod";
import { VerifiedIssue } from "../types.js";
import type { RawIssue, Config } from "../types.js";
import { runAgentWithRetry } from "../runner.js";

const SecondPassResponseSchema = z.discriminatedUnion("confirmed", [
  VerifiedIssue,
  z.object({ confirmed: z.literal(false) }),
]);

export function buildSecondPassPrompt(issue: RawIssue): string {
  return `You are an experienced code reviewer. Verify whether this is actually a rule violation.

RULE: ${issue.rule}
FILE: ${issue.file}
LINE(S): ${issue.line}
PROBLEM DESCRIPTION: ${issue.description}

Instructions:
1. Read the specified file
2. Analyze whether the described problem actually exists
3. If this is a false positive — return {"confirmed": false}

Return ONLY valid JSON:
- If the problem is confirmed:
{
  "confirmed": true,
  "severity": "error" or "warning",
  "file": "path/to/file.ts",
  "line": "42",
  "rule": "rule name",
  "explanation": "detailed explanation of the problem and how to fix it (2-3 sentences)"
}
- If false positive:
{"confirmed": false}

The "line" field can be a single line ("42") or a range ("20-45").`;
}

export async function executeSecondPass(issue: RawIssue, cwd: string, config: Config): Promise<VerifiedIssue | null> {
  const prompt = buildSecondPassPrompt(issue);
  const response = await runAgentWithRetry(config.agent, prompt, config.modelReview, cwd, SecondPassResponseSchema);
  return response.confirmed ? response : null;
}
```

**Step 3: Run full test suite**

```bash
npm test
```

Expected: all PASS.

**Step 4: Commit**

```bash
git add src/passes/first-pass.ts src/passes/second-pass.ts
git commit -m "refactor: passes use runAgentWithRetry with agent from config"
```

---

### Task 5: Update `src/index.ts` — add `--agent` CLI option

**Files:**
- Modify: `src/index.ts`

**Step 1: Add import and `--agent` option**

Add at the top:
```typescript
import { createAgent } from "./agents.js";
import type { AgentType } from "./agents.js";
```

Add the option in the Commander chain (after `--model-review`):
```typescript
.option("--agent <type>", "AI agent to use: claude or qwen", "claude")
```

In the `.action` callback, add agent validation before building `config`:
```typescript
const agentType = opts.agent as string;
if (agentType !== "claude" && agentType !== "qwen") {
  console.error(`Error: --agent must be "claude" or "qwen", got: ${agentType}`);
  process.exit(2);
}

const config: Config = {
  projectPath: resolve(pathArg),
  concurrency,
  modelFast: opts.modelFast,
  modelReview: opts.modelReview,
  outputPath: resolve(opts.output),
  verbose: opts.verbose,
  agent: createAgent(agentType as AgentType),
};
```

**Step 2: Build and verify**

```bash
npm run build
node bin/ai-linter.js --help
```

Expected: `--agent <type>` appears in the options list.

**Step 3: Run full test suite**

```bash
npm test
```

Expected: all PASS.

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add --agent CLI option to select AI agent (claude|qwen)"
```

---

### Task 6: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the CLI options table**

Add `--agent` row:
```markdown
#   --agent <type>          AI agent to use: claude or qwen (default: claude)
```

**Step 2: Update the Architecture section**

Add `src/agents.ts` to the file list:
```markdown
├── agents.ts          — AgentAdapter interface, ClaudeAgent, QwenAgent, createAgent()
```

**Step 3: Update the Claude CLI Integration section**

Replace the section header and first paragraph to reflect the abstraction:

```markdown
## Agent CLI Integration

The tool runs the selected agent CLI as a subprocess for each AI call, e.g.:
- `claude -p <prompt> --model <model> --output-format json`
- `qwen <prompt> --model <model> --output-format json`

Both CLIs wrap the model's response in a JSON envelope `{ result: <string|object> }`.
Each `AgentAdapter` implementation handles building the correct arguments and parsing the response.

**Important:** `claude` refuses to run inside an existing Claude Code session (`CLAUDECODE` env var is set). Run `ai-linter` from a regular terminal, not from inside Claude Code.
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for multi-agent support"
```

---

### Task 7: Final verification

**Step 1: Run full test suite**

```bash
npm test
```

Expected: all PASS, no TypeScript errors.

**Step 2: Build**

```bash
npm run build
```

Expected: no errors.

**Step 3: Verify `--help` output**

```bash
node bin/ai-linter.js --help
```

Expected: `--agent <type>` visible in options.
