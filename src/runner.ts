import { spawn } from "node:child_process";
import type { AgentAdapter } from "./agents.js";
import { inspect } from "util";

export async function runAgent(
  agent: AgentAdapter,
  prompt: string,
  model: undefined | string,
  cwd: string,
  verbose: boolean,
): Promise<string> {
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

      try {
        resolve(agent.getTextResponse(stdout));
      } catch (err) {
        reject(
          new Error(
            `Failed to get ${agent.command} text response: ${err instanceof Error ? err.message : err}\n` +
              `Raw output:\n${stdout}`,
          ),
        );
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ${agent.command}: ${err.message}`));
    });
  });
}

export async function runAgentWithRetry(
  agent: AgentAdapter,
  prompt: string,
  model: undefined | string,
  cwd: string,
  verbose: boolean,
  maxRetries: number,
  executor: (
    agent: AgentAdapter,
    prompt: string,
    model: undefined | string,
    cwd: string,
    verbose: boolean,
  ) => Promise<string> = runAgent,
): Promise<string> {
  const errors: any[] = [];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await executor(agent, prompt, model, cwd, verbose);
    } catch (err) {
      console.log(`    Call to agent failed. Retrying... (${attempt + 1}/${maxRetries})`);
      errors.push(err);
    }
  }
  throw new Error(
    `Agent returned invalid response after ${maxRetries} attempts.\n` + `Errors: ${inspect(errors, undefined, 16)}`,
  );
}
