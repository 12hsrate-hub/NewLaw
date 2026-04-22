const {
  evaluateReleaseEnv,
  formatEnvPreflightResult,
  loadEnvFile,
} = await import("../src/server/ops/release-hardening.ts");

const DEFAULT_ENV_FILE = "/srv/newlaw/app/shared/.env.production";

function parseArgs(argv: string[]) {
  let envFile = DEFAULT_ENV_FILE;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--env-file") {
      envFile = argv[index + 1] ?? envFile;
      index += 1;
    }
  }

  return { envFile };
}

async function main() {
  const { envFile } = parseArgs(process.argv.slice(2));
  const env = await loadEnvFile(envFile);
  const result = evaluateReleaseEnv(env);

  console.log(`[preflight] env file: ${envFile}`);

  for (const line of formatEnvPreflightResult(result)) {
    console.log(`[preflight] ${line}`);
  }

  if (result.blockingFailure) {
    process.exitCode = 1;
  }
}

await main();
