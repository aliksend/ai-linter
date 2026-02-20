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

export interface Config {
  projectPath: string;
  concurrency: number;
  modelFast: string;
  modelReview: string;
  outputPath: string;
  verbose: boolean;
}
