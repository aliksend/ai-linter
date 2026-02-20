import { spawn } from "node:child_process";

export function buildClaudeArgs(prompt: string, model: string): string[] {
  return ["-p", prompt, "--model", model, "--output-format", "json"];
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseClaudeResponse(stdout: string): unknown {
  const parsed = JSON.parse(stdout);
  const result = parsed.result;
  if (result === undefined || result === null) {
    throw new Error(`Claude response missing 'result' field: ${stdout}`);
  }
  if (typeof result === "string") {
    return JSON.parse(stripCodeFences(result));
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

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code ?? "null (signal)"}: ${stderr}`));
        return;
      }
      try {
        resolve(parseClaudeResponse(stdout));
      } catch (err) {
        reject(new Error(
          `Failed to parse claude response: ${err instanceof Error ? err.message : err}\n` +
          `Raw output:\n${stdout}`,
        ));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}
