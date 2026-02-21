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

export interface FirstPassResult {
  ruleFile: RuleFile;
  /** Raw markdown sections from the first pass, one per potential issue */
  sections: string[];
}

export const Config = z.object({
  projectPath: z.string(),
  concurrency: z.number().int(),
  maxRetries: z.number().int(),
  modelFast: z.string().optional(),
  modelReview: z.string().optional(),
  outputPath: z.string(),
  verbose: z.boolean(),
  agent: z.instanceof(AgentAdapter),
});
export type Config = z.infer<typeof Config>;
