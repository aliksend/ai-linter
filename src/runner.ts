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
