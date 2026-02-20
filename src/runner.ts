import { spawn } from "node:child_process";
import { z, ZodError } from "zod";
import type { AgentAdapter } from "./agents.js";

export async function runAgent(
  agent: AgentAdapter,
  prompt: string,
  model: undefined | string,
  cwd: string,
  verbose: boolean,
): Promise<unknown> {
  const args = agent.buildArgs(prompt, model);

  return new Promise((resolve, reject) => {
    const proc = spawn(agent.command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (verbose) {
      console.log(`Starting agent ${agent.command} with ${JSON.stringify(args, null, 2)}`);
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code: number | null) => {
      if (verbose) {
        console.log(`Agent finished with code ${code} and stdout:\n${stdout}`);
      }

      if (code !== 0) {
        reject(new Error(`${agent.command} exited with code ${code ?? "null (signal)"}: ${stderr}`));
        return;
      }

      let agentResponse: string;
      try {
        agentResponse = agent.getJsonResponse(stdout);
      } catch (err) {
        reject(
          new Error(
            `Failed to get ${agent.command} response: ${err instanceof Error ? err.message : err}\n` +
              `Raw output:\n${stdout}`,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(agentResponse));
      } catch (err) {
        reject(
          new Error(
            `Failed to parse ${agent.command} response: ${err instanceof Error ? err.message : err}\n` +
              `Agent response:\n${agentResponse}`,
          ),
        );
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
  model: undefined | string,
  cwd: string,
  schema: z.ZodType<T>,
  verbose: boolean,
  maxRetries = 3,
  executor: (
    agent: AgentAdapter,
    prompt: string,
    model: undefined | string,
    cwd: string,
    verbose: boolean,
  ) => Promise<unknown> = runAgent,
): Promise<T> {
  let lastError: ZodError | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await executor(agent, prompt, model, cwd, verbose);
    const result = schema.safeParse(response);
    if (result.success) return result.data;
    lastError = result.error;
  }
  throw new Error(
    `Agent returned invalid response after ${maxRetries} attempts.\n` +
      `Zod error: ${JSON.stringify(lastError?.issues, null, 2)}`,
  );
}
