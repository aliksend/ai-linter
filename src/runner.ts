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
