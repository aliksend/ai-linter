# ai-linter

AI-powered code linter that checks code against rules defined in `.ai-linter.md` files using Claude as the AI backend.

## Overview

The tool does a two-pass analysis:
1. **First pass** — cheap model (Haiku) scans each directory with rules and returns potential issues as JSON
2. **Second pass** — smart model (Sonnet) verifies each potential issue and confirms/rejects it
3. A Markdown report is written with confirmed errors and warnings

Rules are defined in `.ai-linter.md` files placed in any directory. Each file creates an independent check session scoped to its own directory and all subdirectories (rules do NOT merge between levels).

## Commands

```bash
npm run build        # compile TypeScript → dist/
npm run dev          # watch mode
npm test             # run unit tests (vitest)
npm run test:watch   # watch mode tests
```

```bash
# Run the linter (after build)
node bin/ai-linter.js [path] [options]

# Options:
#   -c, --concurrency <n>   Max parallel Claude sessions (default: 5)
#   --model-fast <model>    Model for first pass (default: haiku)
#   --model-review <model>  Model for second pass (default: sonnet)
#   --agent <type>          AI agent to use: claude or qwen (default: claude)
#   -o, --output <path>     Output report path (default: ai-linter-report.md)
#   -v, --verbose           Print per-file/issue progress
```

## Architecture

```
src/
├── index.ts           — CLI entry point (commander, runWithConcurrency, pipeline)
├── scanner.ts         — finds .ai-linter.md files recursively (fast-glob)
├── runner.ts          — wraps `claude -p` subprocess, parses JSON response
├── agents.ts          — AgentAdapter interface, ClaudeAgent, QwenAgent, createAgent()
├── passes/
│   ├── first-pass.ts  — builds scan prompt, parses RawIssue[]
│   └── second-pass.ts — builds verify prompt, parses VerifiedIssue | null
├── report.ts          — generates Markdown report from VerifiedIssue[]
└── types.ts           — shared TypeScript types
```

### Key types (`src/types.ts`)

- `RuleFile` — a found `.ai-linter.md` with its path, dir, and content
- `RawIssue` — potential issue from first pass (file, line, severity, rule, description)
- `FirstPassResult` — RuleFile + its RawIssue[]
- `VerifiedIssue` — confirmed issue from second pass (adds `explanation`, drops `description`)
- `Config` — CLI options (projectPath, concurrency, modelFast, modelReview, outputPath, verbose, agent)

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Clean or only warnings |
| `1` | At least one `error`-severity issue confirmed |
| `2` | Tool error (claude unavailable, parse failure, etc.) |

## Agent CLI Integration

The tool runs the selected agent CLI as a subprocess for each AI call, e.g.:
- `claude -p <prompt> --model <model> --output-format json`
- `qwen <prompt> --model <model> --output-format json`

Both CLIs wrap the model's response in a JSON envelope `{ result: <string|object> }`.
Each `AgentAdapter` implementation handles building the correct arguments and parsing the response.

**Important:** `claude` refuses to run inside an existing Claude Code session (`CLAUDECODE` env var is set). Run `ai-linter` from a regular terminal, not from inside Claude Code.

## Project Structure

```
ai-linter/
├── bin/ai-linter.js   — shebang entry point (imports dist/index.js)
├── src/               — TypeScript source
├── dist/              — compiled output (gitignored, run `npm run build`)
├── e2e/test-project/  — smoke test fixtures (.ai-linter.md, bad.ts, good.ts)
```

## .ai-linter.md Format

Plain Markdown. Write rules in natural language — Claude reads and interprets them.

Example:
```markdown
# Rules

1. Must not use `console.log` in production code
2. All functions should have an explicit return type
```

## Running E2E Smoke Test

```bash
tsx src/index.ts e2e/test-project -o e2e/test-report.md -v
cat e2e/test-report.md
```

Expected: report with errors/warnings about `bad.ts` (console.log, missing return type) and no issues for `good.ts`.
