import { z } from "zod";
import { AgentAdapter } from "./agents.js";

export const AGENT_TYPES = ["claude", "qwen"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export interface RuleFile {
  /** Absolute path to .ai-linter.md */
  path: string;
  /** Directory containing the .ai-linter.md file */
  dir: string;
  /** Content of the file */
  content: string;
}

export const RawIssue = z.object({
  file: z.string(),
  line: z.string(),
  severity: z.enum(["error", "warning"]),
  rule: z.string(),
  description: z.string(),
});
export type RawIssue = z.infer<typeof RawIssue>;

export interface FirstPassResult {
  ruleFile: RuleFile;
  issues: RawIssue[];
}

export const VerifiedIssue = z.object({
  confirmed: z.literal(true),
  severity: z.enum(["error", "warning"]),
  file: z.string(),
  line: z.string(),
  rule: z.string(),
  explanation: z.string(),
});
export type VerifiedIssue = z.infer<typeof VerifiedIssue>;

export const Config = z.object({
  projectPath: z.string(),
  concurrency: z.number(),
  modelFast: z.string(),
  modelReview: z.string(),
  outputPath: z.string(),
  verbose: z.boolean(),
  agent: z.instanceof(AgentAdapter),
});
export type Config = z.infer<typeof Config>;
