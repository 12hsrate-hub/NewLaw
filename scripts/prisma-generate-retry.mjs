import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const maxAttempts = isWindows ? 3 : 1;
const baseDelayMs = 1200;

function runGenerateAttempt() {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "prisma", "generate"], {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: isWindows,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`prisma generate terminated by signal: ${signal}`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const exitCode = await runGenerateAttempt();

    if (exitCode === 0) {
      process.exit(0);
    }

    if (attempt >= maxAttempts) {
      process.exit(exitCode);
    }

    console.warn(
      `[prisma:generate] Attempt ${attempt}/${maxAttempts} failed on ${process.platform}. Retrying after ${
        baseDelayMs * attempt
      }ms...`,
    );
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
  } catch (error) {
    if (attempt >= maxAttempts) {
      throw error;
    }

    console.warn(
      `[prisma:generate] Attempt ${attempt}/${maxAttempts} failed with runtime error. Retrying after ${
        baseDelayMs * attempt
      }ms...`,
    );
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
  }
}
