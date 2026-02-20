# Multi-Agent Support Design

**Date:** 2026-02-20

## Overview

Make the runner generic so the tool can use different AI agent CLIs (Claude, Qwen Code, etc.) instead of being hardcoded to Claude. The agent type is selected via a `--agent` CLI argument at startup.

## Architecture

### New file: `src/agents.ts`

Defines the `AgentAdapter` interface and concrete class implementations:

```typescript
export interface AgentAdapter {
  command: string;
  buildArgs(prompt: string, model: string): string[];
  parseResponse(stdout: string): unknown;
}

export class ClaudeAgent implements AgentAdapter { ... }
export class QwenAgent implements AgentAdapter { ... }

export type AgentType = "claude" | "qwen";

export function createAgent(type: AgentType): AgentAdapter { ... }
```

- `ClaudeAgent.buildArgs` produces `["-p", prompt, "--model", model, "--output-format", "json"]`
- `QwenAgent.buildArgs` produces `[prompt, "--model", model, "--output-format", "json"]` (positional prompt)
- Both `parseResponse` implementations use the same `{ result: ... }` envelope logic (currently in `parseClaudeResponse`)
- `createAgent(type)` is a factory used at startup to instantiate the correct implementation

### Changes to `src/runner.ts`

- `parseClaudeResponse` moves to `src/agents.ts` (used internally by both adapters)
- `buildClaudeArgs` is removed (replaced by `AgentAdapter.buildArgs`)
- `runClaude` is replaced by `runAgent(agent: AgentAdapter, ...)` which uses `agent.command`, `agent.buildArgs`, and `agent.parseResponse`
- `runClaudeWithRetry` → `runAgentWithRetry(agent: AgentAdapter, prompt, model, cwd, schema, maxRetries)`
  - The injectable `executor` parameter is removed; tests pass a mock `AgentAdapter` instead

### Changes to `src/types.ts`

`Config` gains:
```typescript
agent: AgentAdapter;
```

### Changes to `src/index.ts`

- New CLI option: `--agent <type>` with choices `claude | qwen`, default `claude`
- At startup: `agent: createAgent(opts.agent as AgentType)` stored in `Config`

### Changes to `src/passes/first-pass.ts` and `src/passes/second-pass.ts`

- `runClaudeWithRetry(...)` → `runAgentWithRetry(config.agent, ...)`

## Data Flow

```
CLI --agent qwen
  → createAgent("qwen") → QwenAgent instance
  → stored in Config.agent
  → executeFirstPass(ruleFile, config)
      → runAgentWithRetry(config.agent, prompt, config.modelFast, ...)
          → runAgent(agent, ...) spawns `qwen <prompt> --model <model> --output-format json`
          → agent.parseResponse(stdout) unwraps { result: ... }
          → Zod validates, retries on failure
```

## Testing

- `buildClaudeArgs` tests → `new ClaudeAgent().buildArgs(...)` tests
- `parseClaudeResponse` tests → `new ClaudeAgent().parseResponse(...)` tests
- `runClaudeWithRetry` tests → `runAgentWithRetry(mockAgent, ...)` where `mockAgent` is a plain object implementing `AgentAdapter`
- Add `new QwenAgent().buildArgs(...)` tests

## CLAUDE.md Updates

- Update CLI options table to include `--agent`
- Update architecture section to mention `src/agents.ts`
- Update Claude CLI Integration section to note the abstraction
