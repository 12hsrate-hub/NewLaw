const { getAppRuntimeEnv } = await import("../src/schemas/env.ts");
const {
  classifyOperationalFailure,
  loadEnvFile,
  runMandatorySmoke,
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

function applyEnv(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

async function main() {
  const { envFile } = parseArgs(process.argv.slice(2));
  const env = await loadEnvFile(envFile);
  applyEnv(env);

  const { APP_URL } = getAppRuntimeEnv();

  console.log(`[smoke] env file: ${envFile}`);
  console.log(`[smoke] app url: ${APP_URL}`);

  try {
    const result = await runMandatorySmoke(APP_URL);

    console.log(`[smoke] read-only DB check: server=${result.readOnlyDb.serverSlug}`);
    console.log(
      `[smoke] app-context DB check: runtime=${result.appContext.runtimeStatus}, servers=${result.appContext.serverCount}, warnings=${result.appContext.warningCount}`,
    );

    for (const route of result.routeResults) {
      if (route.kind === "redirect") {
        console.log(
          `[smoke] redirect ${route.url} -> ${route.location ?? "none"} (${route.status})`,
        );
      } else {
        console.log(`[smoke] public ${route.url} (${route.status})`);
      }
    }

    console.log("[smoke] classification=ok");
  } catch (error) {
    const classification = classifyOperationalFailure(error);
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[smoke] classification=${classification}`);
    console.error(`[smoke] error=${message}`);
    process.exitCode = 1;
  }
}

await main();
