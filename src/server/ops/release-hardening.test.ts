import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildMandatoryRouteTargets,
  classifyOperationalFailure,
  evaluateReleaseEnv,
  loadEnvFile,
  runMandatoryHttpSmoke,
} from "@/server/ops/release-hardening";

const validEnv = {
  APP_ENV: "production",
  APP_URL: "https://lawyer5rp.ru",
  DATABASE_URL: "postgresql://user:secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
  DIRECT_URL: "postgresql://user:secret@prod-db.internal:5432/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://prod-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "prod-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "prod-service-role-key",
  AI_PROXY_CONFIGS_JSON:
    '[{"proxyKey":"primary","providerKey":"openai_compatible","endpointUrl":"https://proxy.internal/api","secretEnvKeyName":"AI_PROXY_INTERNAL_TOKEN","model":"gpt-5.4-mini","priority":100,"weight":1,"isEnabled":true,"capabilities":["server_legal_assistant"]}]',
  AI_PROXY_INTERNAL_TOKEN: "prod-internal-token",
  OPENAI_API_KEY: "prod-openai-key",
  FORUM_SESSION_ENCRYPTION_KEY: "abcdefghijklmnopqrstuvwxyz123456",
  OGP_FORUM_THREAD_FORM_URL: "https://forum.gta5rp.com/forums/ogp-section.123/post-thread",
  AI_PROXY_ACTIVE_KEY: "primary",
  AI_REVIEW_ENABLED: "true",
  AI_REVIEW_MODE: "full",
  AI_REVIEW_DAILY_REQUEST_LIMIT: "500",
  AI_REVIEW_DAILY_COST_LIMIT_USD: "25",
} satisfies Record<string, string>;

describe("evaluateReleaseEnv", () => {
  it("marks valid production env as non-blocking", () => {
    const result = evaluateReleaseEnv(validEnv);

    expect(result.blockingFailure).toBe(false);
    expect(result.classification).toBe("ok");
    expect(
      result.checks.every(
        (check) => check.status === "valid" || check.status === "optional_missing",
      ),
    ).toBe(true);
  });

  it("marks missing required env as blocking", () => {
    const result = evaluateReleaseEnv({
      ...validEnv,
      DIRECT_URL: undefined,
    });

    expect(result.blockingFailure).toBe(true);
    expect(result.classification).toBe("external_runtime_env_blocker");
    expect(result.checks.find((check) => check.key === "DIRECT_URL")?.status).toBe(
      "blocking_missing",
    );
  });

  it("marks missing optional env without blocking whole release", () => {
    const result = evaluateReleaseEnv({
      ...validEnv,
      FORUM_SESSION_ENCRYPTION_KEY: undefined,
      OGP_FORUM_THREAD_FORM_URL: undefined,
      AI_PROXY_ACTIVE_KEY: undefined,
      AI_REVIEW_ENABLED: undefined,
      AI_REVIEW_MODE: undefined,
      AI_REVIEW_DAILY_REQUEST_LIMIT: undefined,
      AI_REVIEW_DAILY_COST_LIMIT_USD: undefined,
    });

    expect(result.blockingFailure).toBe(false);
    expect(
      result.checks
        .filter((check) => check.scope === "optional")
        .every((check) => check.status === "optional_missing"),
    ).toBe(true);
  });

  it("marks placeholder required env as non-live and blocking", () => {
    const result = evaluateReleaseEnv({
      ...validEnv,
      APP_URL: "https://example.com",
    });

    expect(result.blockingFailure).toBe(true);
    expect(result.checks.find((check) => check.key === "APP_URL")?.status).toBe(
      "placeholder_non_live",
    );
  });

  it("accepts local postgres runtime urls as valid after VPS cutover", () => {
    const result = evaluateReleaseEnv({
      ...validEnv,
      DATABASE_URL: "postgresql://newlaw_app:secret@127.0.0.1:5433/newlaw_production",
      DIRECT_URL: "postgresql://newlaw_admin:secret@127.0.0.1:5433/newlaw_production",
    });

    expect(result.blockingFailure).toBe(false);
    expect(result.checks.find((check) => check.key === "DATABASE_URL")?.status).toBe("valid");
    expect(result.checks.find((check) => check.key === "DIRECT_URL")?.status).toBe("valid");
  });

  it("marks invalid AI review controls as optional non-live without blocking whole release", () => {
    const result = evaluateReleaseEnv({
      ...validEnv,
      AI_REVIEW_MODE: "chaos",
    });

    expect(result.blockingFailure).toBe(false);
    expect(result.checks.find((check) => check.key === "AI_REVIEW_MODE")?.status).toBe(
      "placeholder_non_live",
    );
  });
});

describe("loadEnvFile", () => {
  it("parses simple env files without logging values", async () => {
    const dir = await mkdtemp(join(tmpdir(), "release-env-"));
    const filePath = join(dir, ".env.production");

    await writeFile(
      filePath,
      [
        "APP_ENV=production",
        "APP_URL=https://lawyer5rp.ru",
        "AI_PROXY_INTERNAL_TOKEN=\"prod-token\"",
        "# comment",
      ].join("\n"),
      "utf8",
    );

    const env = await loadEnvFile(filePath);

    expect(env.APP_ENV).toBe("production");
    expect(env.APP_URL).toBe("https://lawyer5rp.ru");
    expect(env.AI_PROXY_INTERNAL_TOKEN).toBe("prod-token");
  });
});

describe("mandatory smoke helpers", () => {
  it("builds stable mandatory route targets", () => {
    const targets = buildMandatoryRouteTargets("https://lawyer5rp.ru", "blackberry");

    expect(targets).toHaveLength(8);
    expect(targets[0]?.url).toBe("https://lawyer5rp.ru/api/health");
    expect(targets[6]?.expectedLocation).toBe(
      "/sign-in?next=%2Fservers%2Fblackberry",
    );
  });

  it("runs expected public and redirect checks with injected fetch", async () => {
    const results = await runMandatoryHttpSmoke(
      "https://lawyer5rp.ru",
      "blackberry",
      async (input) => {
        const url = String(input);

        if (
          url.endsWith("/api/health") ||
          url.endsWith("/sign-in") ||
          url.endsWith("/forgot-password") ||
          url.endsWith("/assistant") ||
          url.endsWith("/servers")
        ) {
          return new Response(null, { status: 200 });
        }

        if (url.endsWith("/account")) {
          return new Response(null, {
            status: 307,
            headers: { location: "/sign-in?next=%2Faccount" },
          });
        }

        if (url.endsWith("/servers/blackberry")) {
          return new Response(null, {
            status: 307,
            headers: { location: "/sign-in?next=%2Fservers%2Fblackberry" },
          });
        }

        return new Response(null, {
          status: 307,
          headers: { location: "/sign-in?next=%2Finternal" },
        });
      },
    );

    expect(results).toHaveLength(8);
    expect(results.filter((result) => result.kind === "public")).toHaveLength(5);
    expect(results.filter((result) => result.kind === "redirect")).toHaveLength(3);
  });
});

describe("classifyOperationalFailure", () => {
  it("classifies env-style failures as runtime blockers", () => {
    const classification = classifyOperationalFailure(
      new Error("Environment variable not found: DIRECT_URL"),
    );

    expect(classification).toBe("external_runtime_env_blocker");
  });

  it("classifies transient network failures as flaky", () => {
    const classification = classifyOperationalFailure(
      new Error("fetch failed: ECONNRESET"),
    );

    expect(classification).toBe("flaky_operational_issue");
  });
});
