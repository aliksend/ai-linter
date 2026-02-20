import { spawn } from "node:child_process";
import { z, ZodError } from "zod";

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
    let resultStr = result;

    const fenseStart = resultStr.indexOf("```");
    if (fenseStart !== -1) {
      resultStr = resultStr.slice(fenseStart + 3).replace(/^json/, "");
    }
    resultStr = stripCodeFences(resultStr);

    // console.log("> TO PARSE", resultStr);

    return JSON.parse(resultStr);
  }
  return result;
}

export async function runClaude(prompt: string, model: string, cwd: string): Promise<unknown> {
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
        reject(
          new Error(
            `Failed to parse claude response: ${err instanceof Error ? err.message : err}\n` + `Raw output:\n${stdout}`,
          ),
        );
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export async function runClaudeWithRetry<T>(
  prompt: string,
  model: string,
  cwd: string,
  schema: z.ZodType<T>,
  maxRetries = 3,
  executor: (prompt: string, model: string, cwd: string) => Promise<unknown> = runClaude,
): Promise<T> {
  let lastError: ZodError | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await executor(prompt, model, cwd);
    const result = schema.safeParse(response);
    if (result.success) return result.data;
    lastError = result.error;
  }
  throw new Error(
    `Claude returned invalid response after ${maxRetries} attempts.\n` +
    `Zod error: ${JSON.stringify(lastError?.issues, null, 2)}`,
  );
}
