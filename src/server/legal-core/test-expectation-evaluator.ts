import type {
  AILegalCoreScenarioExpectationProfile,
  AILegalCoreScenarioPrimaryBasisMatcher,
} from "@/server/legal-core/test-scenarios-registry";

export type ExpectationCheckStatus =
  | "passed"
  | "failed"
  | "not_evaluable"
  | "future_reserved";

export type ExpectationCheckResult = {
  key: string;
  status: ExpectationCheckStatus;
  expected: unknown;
  actual: unknown;
  message: string;
};

export type ExpectationEvaluationSnapshot = {
  selected_norm_roles: Array<{
    law_id?: string | null;
    law_version?: string | null;
    law_block_id?: string | null;
    law_family?: string | null;
    norm_role?: string | null;
    applicability_score?: number | null;
  }>;
  primary_basis_eligibility: Array<{
    law_id?: string | null;
    law_version?: string | null;
    law_block_id?: string | null;
    primary_basis_eligibility?: string | null;
  }>;
  direct_basis_status?: string | null;
  used_sources?: Array<{
    source_kind?: string | null;
    law_id?: string | null;
    law_name?: string | null;
    article_number?: string | null;
  }>;
  technical?: {
    tokens?: number | null;
    costUsd?: number | null;
    latencyMs?: number | null;
  } | null;
  stage_usage?: Record<string, unknown> | null;
};

export type ExpectationEvaluationResult = {
  checks: ExpectationCheckResult[];
  passed_expectations: ExpectationCheckResult[];
  failed_expectations: ExpectationCheckResult[];
  expectation_summary: {
    passed: number;
    failed: number;
    not_evaluable: number;
    future_reserved: number;
  };
};

function matchesPrimaryBasisMatcher(
  matcher: AILegalCoreScenarioPrimaryBasisMatcher,
  candidate: {
    law_id: string | null;
    law_family: string | null;
    law_name: string | null;
  },
) {
  if (matcher.lawId && matcher.lawId !== candidate.law_id) {
    return false;
  }

  if (matcher.lawFamily && matcher.lawFamily !== candidate.law_family) {
    return false;
  }

  if (matcher.lawTitleIncludes && matcher.lawTitleIncludes.length > 0) {
    if (!candidate.law_name) {
      return false;
    }

    const normalizedLawName = candidate.law_name.toLowerCase();

    return matcher.lawTitleIncludes.some((entry) =>
      normalizedLawName.includes(entry.toLowerCase()),
    );
  }

  return true;
}

function buildStatusCheck(input: Omit<ExpectationCheckResult, "message"> & { message?: string }) {
  return {
    ...input,
    message:
      input.message ??
      (input.status === "passed"
        ? "Ожидание выполнено."
        : input.status === "failed"
          ? "Ожидание не выполнено."
          : input.status === "not_evaluable"
            ? "Ожидание не удалось проверить по доступным данным."
            : "Ожидание зарезервировано для future substep."),
  } satisfies ExpectationCheckResult;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string")));
}

function buildPrimaryBasisCandidates(snapshot: ExpectationEvaluationSnapshot) {
  const lawNameById = new Map<string, string>();

  for (const source of snapshot.used_sources ?? []) {
    if (source.law_id && source.law_name) {
      lawNameById.set(source.law_id, source.law_name);
    }
  }

  return snapshot.selected_norm_roles
    .filter((entry) => entry.norm_role === "primary_basis")
    .map((entry) => ({
      law_id: entry.law_id ?? null,
      law_family: entry.law_family ?? null,
      law_name: entry.law_id ? (lawNameById.get(entry.law_id) ?? null) : null,
    }));
}

function countEligiblePrimaryBasisNorms(snapshot: ExpectationEvaluationSnapshot) {
  const primaryBasisEntries = snapshot.selected_norm_roles.filter(
    (entry) => entry.norm_role === "primary_basis",
  );
  const eligibilities = snapshot.primary_basis_eligibility;

  if (eligibilities.length === 0) {
    return primaryBasisEntries.length;
  }

  return primaryBasisEntries.filter((entry) =>
    eligibilities.some(
      (eligibility) =>
        eligibility.law_id === (entry.law_id ?? null) &&
        eligibility.law_version === (entry.law_version ?? null) &&
        eligibility.law_block_id === (entry.law_block_id ?? null) &&
        eligibility.primary_basis_eligibility === "eligible",
    ),
  ).length;
}

export function evaluateScenarioExpectations(input: {
  expectationProfile: AILegalCoreScenarioExpectationProfile | null | undefined;
  snapshot: ExpectationEvaluationSnapshot;
}): ExpectationEvaluationResult {
  const expectationProfile = input.expectationProfile ?? null;

  if (!expectationProfile) {
    return {
      checks: [],
      passed_expectations: [],
      failed_expectations: [],
      expectation_summary: {
        passed: 0,
        failed: 0,
        not_evaluable: 0,
        future_reserved: 0,
      },
    };
  }

  const checks: ExpectationCheckResult[] = [];
  const selectedLawFamilies = uniqueStrings(
    input.snapshot.selected_norm_roles.map((entry) => entry.law_family ?? null),
  );
  const selectedNormRoles = uniqueStrings(
    input.snapshot.selected_norm_roles.map((entry) => entry.norm_role ?? null),
  );

  if (expectationProfile.requiredLawFamilies) {
    const missing = expectationProfile.requiredLawFamilies.filter(
      (family) => !selectedLawFamilies.includes(family),
    );

    checks.push(
      buildStatusCheck({
        key: "requiredLawFamilies",
        status: missing.length === 0 ? "passed" : "failed",
        expected: expectationProfile.requiredLawFamilies,
        actual: selectedLawFamilies,
        message:
          missing.length === 0
            ? "Все обязательные LawFamily присутствуют в selected legal context."
            : `Отсутствуют обязательные LawFamily: ${missing.join(", ")}.`,
      }),
    );
  }

  if (expectationProfile.requiredNormRoles) {
    const missing = expectationProfile.requiredNormRoles.filter(
      (role) => !selectedNormRoles.includes(role),
    );

    checks.push(
      buildStatusCheck({
        key: "requiredNormRoles",
        status: missing.length === 0 ? "passed" : "failed",
        expected: expectationProfile.requiredNormRoles,
        actual: selectedNormRoles,
        message:
          missing.length === 0
            ? "Все обязательные NormRole присутствуют в selected legal context."
            : `Отсутствуют обязательные NormRole: ${missing.join(", ")}.`,
      }),
    );
  }

  if (expectationProfile.forbiddenLawFamilies) {
    const found = expectationProfile.forbiddenLawFamilies.filter((family) =>
      selectedLawFamilies.includes(family),
    );

    checks.push(
      buildStatusCheck({
        key: "forbiddenLawFamilies",
        status: found.length === 0 ? "passed" : "failed",
        expected: expectationProfile.forbiddenLawFamilies,
        actual: selectedLawFamilies,
        message:
          found.length === 0
            ? "Forbidden LawFamily не попали в selected legal context."
            : `Найдены forbidden LawFamily: ${found.join(", ")}.`,
      }),
    );
  }

  if (expectationProfile.forbiddenNormRoles) {
    const found = expectationProfile.forbiddenNormRoles.filter((role) =>
      selectedNormRoles.includes(role),
    );

    checks.push(
      buildStatusCheck({
        key: "forbiddenNormRoles",
        status: found.length === 0 ? "passed" : "failed",
        expected: expectationProfile.forbiddenNormRoles,
        actual: selectedNormRoles,
        message:
          found.length === 0
            ? "Forbidden NormRole не попали в selected legal context."
            : `Найдены forbidden NormRole: ${found.join(", ")}.`,
      }),
    );
  }

  if (typeof expectationProfile.minPrimaryBasisNorms === "number") {
    const eligiblePrimaryBasisNormCount = countEligiblePrimaryBasisNorms(input.snapshot);

    checks.push(
      buildStatusCheck({
        key: "minPrimaryBasisNorms",
        status:
          eligiblePrimaryBasisNormCount >= expectationProfile.minPrimaryBasisNorms
            ? "passed"
            : "failed",
        expected: expectationProfile.minPrimaryBasisNorms,
        actual: eligiblePrimaryBasisNormCount,
        message:
          eligiblePrimaryBasisNormCount >= expectationProfile.minPrimaryBasisNorms
            ? "Минимальное число primary basis norms выдержано."
            : "Недостаточно primary basis norms с eligible status.",
      }),
    );
  }

  if (expectationProfile.forbiddenPrimaryBasis) {
    const primaryBasisCandidates = buildPrimaryBasisCandidates(input.snapshot);
    const matches = primaryBasisCandidates.filter((candidate) =>
      expectationProfile.forbiddenPrimaryBasis?.some((matcher) =>
        matchesPrimaryBasisMatcher(matcher, candidate),
      ),
    );

    checks.push(
      buildStatusCheck({
        key: "forbiddenPrimaryBasis",
        status: matches.length === 0 ? "passed" : "failed",
        expected: expectationProfile.forbiddenPrimaryBasis,
        actual: matches,
        message:
          matches.length === 0
            ? "Forbidden primary basis candidates не обнаружены."
            : "Обнаружен forbidden primary basis в selected legal context.",
      }),
    );
  }

  if (expectationProfile.expectedDirectBasisStatus) {
    checks.push(
      buildStatusCheck({
        key: "expectedDirectBasisStatus",
        status:
          input.snapshot.direct_basis_status ===
          expectationProfile.expectedDirectBasisStatus
            ? "passed"
            : "failed",
        expected: expectationProfile.expectedDirectBasisStatus,
        actual: input.snapshot.direct_basis_status ?? null,
        message:
          input.snapshot.direct_basis_status ===
          expectationProfile.expectedDirectBasisStatus
            ? "direct_basis_status совпадает с expectation."
            : "direct_basis_status расходится с expectation.",
      }),
    );
  }

  if (typeof expectationProfile.maxTokens === "number") {
    const actualTokens = input.snapshot.technical?.tokens ?? null;

    checks.push(
      buildStatusCheck({
        key: "maxTokens",
        status:
          actualTokens === null
            ? "not_evaluable"
            : actualTokens <= expectationProfile.maxTokens
              ? "passed"
              : "failed",
        expected: expectationProfile.maxTokens,
        actual: actualTokens,
        message:
          actualTokens === null
            ? "Token usage отсутствует в technical snapshot."
            : actualTokens <= expectationProfile.maxTokens
              ? "Token budget выдержан."
              : "Token budget превышен.",
      }),
    );
  }

  if (typeof expectationProfile.maxLatency === "number") {
    const actualLatency = input.snapshot.technical?.latencyMs ?? null;

    checks.push(
      buildStatusCheck({
        key: "maxLatency",
        status:
          actualLatency === null
            ? "not_evaluable"
            : actualLatency <= expectationProfile.maxLatency
              ? "passed"
              : "failed",
        expected: expectationProfile.maxLatency,
        actual: actualLatency,
        message:
          actualLatency === null
            ? "Latency отсутствует в technical snapshot."
            : actualLatency <= expectationProfile.maxLatency
              ? "Latency budget выдержан."
              : "Latency budget превышен.",
      }),
    );
  }

  const futureReservedFields = [
    "requiredCompanionRelations",
    "expectedNormBundle",
    "forbiddenCompanionAsPrimary",
    "missingCompanionWarning",
  ] as const satisfies ReadonlyArray<keyof AILegalCoreScenarioExpectationProfile>;

  for (const key of futureReservedFields) {
    const value = expectationProfile[key];

    if (typeof value !== "undefined") {
      checks.push(
        buildStatusCheck({
          key,
          status: "future_reserved",
          expected: value,
          actual: null,
          message:
            "Поле expectation profile зарезервировано для 16.3 и пока не валидируется жёстко.",
        }),
      );
    }
  }

  return {
    checks,
    passed_expectations: checks.filter((check) => check.status === "passed"),
    failed_expectations: checks.filter((check) => check.status === "failed"),
    expectation_summary: {
      passed: checks.filter((check) => check.status === "passed").length,
      failed: checks.filter((check) => check.status === "failed").length,
      not_evaluable: checks.filter((check) => check.status === "not_evaluable").length,
      future_reserved: checks.filter((check) => check.status === "future_reserved").length,
    },
  };
}
