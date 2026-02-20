import { z } from "zod";

export interface RuleFile {
  /** Absolute path to .ai-linter.md */
  path: string;
  /** Directory containing the .ai-linter.md file */
  dir: string;
  /** Content of the file */
  content: string;
}

export const RawIssueSchema = z.object({
  file: z.string(),
  line: z.string(),
  severity: z.enum(["error", "warning"]),
  rule: z.string(),
  description: z.string(),
});
export type RawIssue = z.infer<typeof RawIssueSchema>;

export interface FirstPassResult {
  ruleFile: RuleFile;
  issues: RawIssue[];
}

export const VerifiedIssueSchema = z.object({
  confirmed: z.literal(true),
  severity: z.enum(["error", "warning"]),
  file: z.string(),
  line: z.string(),
  rule: z.string(),
  explanation: z.string(),
});
export type VerifiedIssue = z.infer<typeof VerifiedIssueSchema>;

export interface Config {
  projectPath: string;
  concurrency: number;
  modelFast: string;
  modelReview: string;
  outputPath: string;
  verbose: boolean;
}
