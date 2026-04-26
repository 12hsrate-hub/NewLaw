import { buildAssistantRetrievalQuery } from "@/server/legal-core/assistant-retrieval-query";
import {
  buildCitationConstraints,
  buildCitationDiagnostics,
  mergeExplicitLegalCitations,
  parseExplicitLegalCitations,
  type CitationConstraints,
  type CitationDiagnostics,
  type ExplicitLegalCitation,
} from "@/server/legal-core/legal-citation-parser";
import { LEGAL_SEMANTIC_LEGAL_ISSUE_SIGNALS } from "@/server/legal-core/legal-semantic-dictionaries";
import type {
  LegalCoreActorContext,
  LegalCoreIntent,
  LegalCoreResponseMode,
} from "@/server/legal-core/metadata";
import type { LawFamily, NormRole } from "@/server/legal-core/legal-selection";

export const legalAnchors = [
  "administrative_offense",
  "detention_procedure",
  "attorney_rights",
  "attorney_request",
  "video_recording",
  "official_duty",
  "sanction",
  "exception",
  "remedy",
  "evidence",
] as const;

export type LegalAnchor = (typeof legalAnchors)[number];

export const legalIssueTypes = [
  "duty_question",
  "right_question",
  "deadline_question",
  "refusal_question",
  "evidence_question",
  "sanction_question",
  "procedure_question",
  "qualification_question",
  "remedy_question",
  "citation_explanation",
  "citation_application",
  "document_strategy",
  "unclear",
] as const;

export const legalIssueConfidences = ["high", "medium", "low"] as const;

export type LegalIssueType = (typeof legalIssueTypes)[number];
export type LegalIssueConfidence = (typeof legalIssueConfidences)[number];

export const legalIssueSignalSources = [
  "normalized_input",
  "intent",
  "actor_context",
  "legal_anchor",
  "citation_hint",
] as const;

export type LegalIssueSignalSource = (typeof legalIssueSignalSources)[number];

export type LegalIssueSignal = {
  issueType: Exclude<LegalIssueType, "unclear">;
  signal: string;
  source: LegalIssueSignalSource;
};

export type LegalIssueDiagnostics = {
  legal_issue_type: LegalIssueType;
  legal_issue_secondary_types: Exclude<LegalIssueType, "unclear">[];
  legal_issue_confidence: LegalIssueConfidence;
  legal_issue_signals: LegalIssueSignal[];
  legal_issue_unclear_reason: string | null;
};

export type LegalQueryPlan = {
  normalized_input: string;
  intent: LegalCoreIntent;
  actor_context: LegalCoreActorContext;
  response_mode: LegalCoreResponseMode;
  server_id: string;
  law_version: "current_snapshot_only";
  question_scope: "general_question" | "self_case" | "representative_case";
  legal_anchors: LegalAnchor[];
  required_law_families: LawFamily[];
  preferred_norm_roles: NormRole[];
  forbidden_scope_markers: string[];
  expanded_query: string;
  explicitLegalCitations: ExplicitLegalCitation[];
  citationConstraints: CitationConstraints;
  citationDiagnostics: CitationDiagnostics;
  primaryLegalIssueType: LegalIssueType;
  secondaryLegalIssueTypes: Exclude<LegalIssueType, "unclear">[];
  legalIssueConfidence: LegalIssueConfidence;
  legalIssueDiagnostics: LegalIssueDiagnostics;
};

function hasKeyword(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function hasAttorneyRightsSignals(source: string) {
  return hasKeyword(source, [
    "задерж",
    "арест",
    "защитник",
    "не дали адвоката",
    "право на адвоката",
    "право на защит",
    "звонок",
    "миранда",
    "допуск защитника",
    "допустить защитника",
  ]);
}

function hasAttorneyRequestSignals(source: string) {
  return hasKeyword(source, ["адвокатск"]) && hasKeyword(source, ["запрос"]);
}

function hasAttorneyRequestSanctionSignals(source: string) {
  return hasKeyword(source, [
    "что грозит",
    "ответственност",
    "наказан",
    "привлеч",
    "уголовк",
    "ст. 84",
    "84 ук",
    "не исполнен",
    "неисполн",
    "ненадлежащ",
    "воспрепятств",
  ]);
}

function pushUniqueValue<T>(target: T[], value: T) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function pushUniqueValues<T>(target: T[], values: T[]) {
  for (const value of values) {
    pushUniqueValue(target, value);
  }
}

function normalizeQuestion(input: string) {
  return input.trim().toLowerCase();
}

const legalIssuePriorityOrder = [
  "citation_explanation",
  "citation_application",
  "deadline_question",
  "refusal_question",
  "right_question",
  "duty_question",
  "evidence_question",
  "qualification_question",
  "sanction_question",
  "remedy_question",
  "procedure_question",
  "document_strategy",
  "unclear",
] as const satisfies readonly LegalIssueType[];

const legalIssuePriorityRank = new Map(
  legalIssuePriorityOrder.map((issueType, index) => [issueType, index] as const),
);

const citationHintRegex =
  /(?:ст\.?\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:ак|пк|ук|эк|зоа)|закон[а-я\s"]+об адвокатуре|конституц)/i;

function hasCitationLikeHint(source: string) {
  return citationHintRegex.test(source);
}

function hasStrongSubstantiveIssueSignal(source: string) {
  return hasKeyword(source, [
    "обязаны ли",
    "должен ли",
    "не ответил",
    "не ответило",
    "не ответили",
    "не предоставил",
    "не предоставили",
    "не дали",
    "отказали",
    "что делать",
    "как оформить",
    "как подать",
    "как обжал",
    "что писать в жалобе",
    "как написать жалобу",
    "куда жалоб",
    "меня задержали",
    "если руководство",
  ]);
}

function isExplicitPhrase(signal: string) {
  return signal.includes(" ") || signal.includes(".");
}

function createLegalIssueScoreMap() {
  return new Map<Exclude<LegalIssueType, "unclear">, number>(
    legalIssueTypes
      .filter((issueType): issueType is Exclude<LegalIssueType, "unclear"> => issueType !== "unclear")
      .map((issueType) => [issueType, 0]),
  );
}

function pushLegalIssueSignal(
  signals: LegalIssueSignal[],
  candidate: LegalIssueSignal,
  scores: Map<Exclude<LegalIssueType, "unclear">, number>,
  weight: number,
) {
  signals.push(candidate);
  scores.set(candidate.issueType, (scores.get(candidate.issueType) ?? 0) + weight);
}

function addTextualSignals(input: {
  normalizedInput: string;
  scores: Map<Exclude<LegalIssueType, "unclear">, number>;
  signals: LegalIssueSignal[];
}) {
  for (const [issueType, rawSignals] of Object.entries(LEGAL_SEMANTIC_LEGAL_ISSUE_SIGNALS) as Array<
    [Exclude<LegalIssueType, "unclear">, readonly string[]]
  >) {
    const matchedSignals: string[] = [];
    const sortedSignals = [...rawSignals].sort((left, right) => right.length - left.length);

    for (const signal of sortedSignals) {
      if (!input.normalizedInput.includes(signal)) {
        continue;
      }

      if (matchedSignals.some((existingSignal) => existingSignal.includes(signal))) {
        continue;
      }

      matchedSignals.push(signal);

      pushLegalIssueSignal(
        input.signals,
        {
          issueType,
          signal,
          source: "normalized_input",
        },
        input.scores,
        isExplicitPhrase(signal) ? 2 : 1,
      );
    }
  }
}

function addIntentBoosts(input: {
  intent: LegalCoreIntent;
  scores: Map<Exclude<LegalIssueType, "unclear">, number>;
  signals: LegalIssueSignal[];
}) {
  switch (input.intent) {
    case "complaint_strategy":
      pushLegalIssueSignal(
        input.signals,
        {
          issueType: "remedy_question",
          signal: "intent:complaint_strategy",
          source: "intent",
        },
        input.scores,
        1,
      );
      pushLegalIssueSignal(
        input.signals,
        {
          issueType: "document_strategy",
          signal: "intent:complaint_strategy",
          source: "intent",
        },
        input.scores,
        1,
      );
      break;
    case "evidence_check":
      pushLegalIssueSignal(
        input.signals,
        {
          issueType: "evidence_question",
          signal: "intent:evidence_check",
          source: "intent",
        },
        input.scores,
        1,
      );
      break;
    case "qualification_check":
      pushLegalIssueSignal(
        input.signals,
        {
          issueType: "qualification_question",
          signal: "intent:qualification_check",
          source: "intent",
        },
        input.scores,
        2,
      );
      break;
    case "document_text_improvement":
      pushLegalIssueSignal(
        input.signals,
        {
          issueType: "document_strategy",
          signal: "intent:document_text_improvement",
          source: "intent",
        },
        input.scores,
        2,
      );
      break;
    default:
      break;
  }
}

function addActorContextBoosts(input: {
  actorContext: LegalCoreActorContext;
  normalizedInput: string;
  scores: Map<Exclude<LegalIssueType, "unclear">, number>;
  signals: LegalIssueSignal[];
}) {
  if (input.actorContext === "general_question") {
    return;
  }

  if (
    hasKeyword(input.normalizedInput, [
      "не дали",
      "не предоставили",
      "задерж",
      "адвокат",
      "защитник",
      "жалоб",
      "оспор",
    ])
  ) {
    pushLegalIssueSignal(
      input.signals,
      {
        issueType: "right_question",
        signal: `actor_context:${input.actorContext}`,
        source: "actor_context",
      },
      input.scores,
      1,
    );
  }
}

function addAnchorBoosts(input: {
  legalAnchors: LegalAnchor[];
  scores: Map<Exclude<LegalIssueType, "unclear">, number>;
  signals: LegalIssueSignal[];
}) {
  for (const anchor of input.legalAnchors) {
    switch (anchor) {
      case "attorney_request":
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "duty_question",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "deadline_question",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        break;
      case "attorney_rights":
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "right_question",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        break;
      case "detention_procedure":
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "procedure_question",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        break;
      case "video_recording":
      case "evidence":
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "evidence_question",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        break;
      case "sanction":
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "sanction_question",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        break;
      case "remedy":
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "remedy_question",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "document_strategy",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        break;
      case "official_duty":
        pushLegalIssueSignal(
          input.signals,
          {
            issueType: "duty_question",
            signal: `anchor:${anchor}`,
            source: "legal_anchor",
          },
          input.scores,
          1,
        );
        break;
      default:
        break;
    }
  }
}

function addCitationBoosts(input: {
  normalizedInput: string;
  originalInput?: string;
  explicitCitationCount: number;
  scores: Map<Exclude<LegalIssueType, "unclear">, number>;
  signals: LegalIssueSignal[];
}) {
  const citationIssueSource = normalizeQuestion(
    [input.originalInput ?? "", input.normalizedInput].filter((value) => value.trim().length > 0).join(" "),
  );

  if (input.explicitCitationCount === 0 && !hasCitationLikeHint(citationIssueSource)) {
    return;
  }

  const explanationPhrasing = hasKeyword(citationIssueSource, [
    "что значит",
    "что означает",
    "что написано в",
    "как понимать",
  ]);
  const applicationPhrasing = hasKeyword(citationIssueSource, [
    "можно ли по",
    "применима ли",
    "подходит ли",
    "квалифицируется ли по",
    "привлечь по",
  ]);
  const bareCitationReference =
    input.explicitCitationCount > 0 &&
    !explanationPhrasing &&
    !applicationPhrasing &&
    !hasStrongSubstantiveIssueSignal(citationIssueSource);

  if (explanationPhrasing) {
    pushLegalIssueSignal(
      input.signals,
      {
        issueType: "citation_explanation",
        signal: "explicit_citation_explanation",
        source: "citation_hint",
      },
      input.scores,
      3,
    );
  }

  if (applicationPhrasing) {
    pushLegalIssueSignal(
      input.signals,
      {
        issueType: "citation_application",
        signal: "explicit_citation_application",
        source: "citation_hint",
      },
      input.scores,
      3,
    );
  }

  if (bareCitationReference) {
    pushLegalIssueSignal(
      input.signals,
      {
        issueType: "citation_explanation",
        signal: "explicit_citation_bare_reference",
        source: "citation_hint",
      },
      input.scores,
      3,
    );
  }
}

function addPatternBoosts(input: {
  normalizedInput: string;
  scores: Map<Exclude<LegalIssueType, "unclear">, number>;
  signals: LegalIssueSignal[];
}) {
  if (hasKeyword(input.normalizedInput, ["обязаны ли", "должен ли"])) {
    pushLegalIssueSignal(
      input.signals,
      {
        issueType: "duty_question",
        signal: "question_form:obligation",
        source: "normalized_input",
      },
      input.scores,
      1,
    );
  }

  if (
    hasKeyword(input.normalizedInput, [
      "не ответил",
      "не ответило",
      "не ответили",
      "не предоставил",
      "не предоставили",
      "не дали",
      "отказали",
    ])
  ) {
    pushLegalIssueSignal(
      input.signals,
      {
        issueType: "refusal_question",
        signal: "negative_outcome_phrase",
        source: "normalized_input",
      },
      input.scores,
      2,
    );
  }

  if (hasKeyword(input.normalizedInput, ["не дали звонок", "не дали адвоката"])) {
    pushLegalIssueSignal(
      input.signals,
      {
        issueType: "right_question",
        signal: "deprived_specific_right",
        source: "normalized_input",
      },
      input.scores,
      2,
    );
  }

  if (hasCitationLikeHint(input.normalizedInput) && hasKeyword(input.normalizedInput, [" ук", "уголов"])) {
    pushLegalIssueSignal(
      input.signals,
      {
        issueType: "sanction_question",
        signal: "citation_points_to_criminal_scope",
        source: "citation_hint",
      },
      input.scores,
      1,
    );
  }
}

function compareLegalIssuePriority(
  left: LegalIssueType,
  right: LegalIssueType,
) {
  return (legalIssuePriorityRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (legalIssuePriorityRank.get(right) ?? Number.MAX_SAFE_INTEGER);
}

export function classifyLegalIssueTypes(input: {
  normalizedInput: string;
  originalInput?: string;
  intent: LegalCoreIntent;
  actorContext: LegalCoreActorContext;
  legalAnchors: LegalAnchor[];
  explicitCitations?: ExplicitLegalCitation[];
}) {
  const normalizedInput = normalizeQuestion(input.normalizedInput);
  const scores = createLegalIssueScoreMap();
  const signals: LegalIssueSignal[] = [];

  addTextualSignals({
    normalizedInput,
    scores,
    signals,
  });
  addIntentBoosts({
    intent: input.intent,
    scores,
    signals,
  });
  addActorContextBoosts({
    actorContext: input.actorContext,
    normalizedInput,
    scores,
    signals,
  });
  addAnchorBoosts({
    legalAnchors: input.legalAnchors,
    scores,
    signals,
  });
  addCitationBoosts({
    normalizedInput,
    originalInput: input.originalInput,
    explicitCitationCount: input.explicitCitations?.length ?? 0,
    scores,
    signals,
  });
  addPatternBoosts({
    normalizedInput,
    scores,
    signals,
  });

  const scoredIssueTypes = Array.from(scores.entries())
    .filter(([, score]) => score > 0)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return compareLegalIssuePriority(left[0], right[0]);
    });

  if (scoredIssueTypes.length === 0) {
    return {
      primaryLegalIssueType: "unclear" as const,
      secondaryLegalIssueTypes: [],
      legalIssueConfidence: "low" as const,
      legalIssueDiagnostics: {
        legal_issue_type: "unclear" as const,
        legal_issue_secondary_types: [],
        legal_issue_confidence: "low" as const,
        legal_issue_signals: [],
        legal_issue_unclear_reason: "no_clear_issue_signals",
      } satisfies LegalIssueDiagnostics,
    };
  }

  const [primaryLegalIssueType, primaryScore] = scoredIssueTypes[0];
  const primarySignals = signals.filter((signal) => signal.issueType === primaryLegalIssueType);
  const hasStrongPhraseSignal = primarySignals.some(
    (signal) =>
      signal.source === "citation_hint" ||
      (signal.source === "normalized_input" && isExplicitPhrase(signal.signal)),
  );
  const runnerUpScore = scoredIssueTypes[1]?.[1] ?? 0;
  const legalIssueConfidence: LegalIssueConfidence =
    primarySignals.length >= 2 || hasStrongPhraseSignal
      ? "high"
      : primaryScore >= runnerUpScore + 2
        ? "medium"
        : "low";
  const issueTypesWithEligibleSecondarySignals = new Set(
    signals
      .filter((signal) => signal.source !== "actor_context")
      .map((signal) => signal.issueType),
  );
  const secondaryLegalIssueTypes = scoredIssueTypes
    .slice(1)
    .filter(
      ([issueType, score]) =>
        score >= Math.max(primaryScore - 2, 1) && issueTypesWithEligibleSecondarySignals.has(issueType),
    )
    .map(([issueType]) => issueType)
    .sort(compareLegalIssuePriority)
    .slice(0, 3);

  return {
    primaryLegalIssueType,
    secondaryLegalIssueTypes,
    legalIssueConfidence,
    legalIssueDiagnostics: {
      legal_issue_type: primaryLegalIssueType,
      legal_issue_secondary_types: secondaryLegalIssueTypes,
      legal_issue_confidence: legalIssueConfidence,
      legal_issue_signals: signals,
      legal_issue_unclear_reason: legalIssueConfidence === "low" && runnerUpScore >= primaryScore - 1
        ? "competing_issue_signals"
        : null,
    } satisfies LegalIssueDiagnostics,
  };
}

function buildLegalAnchors(input: {
  normalizedInput: string;
  intent: LegalCoreIntent;
}): LegalAnchor[] {
  const normalizedSource = normalizeQuestion(input.normalizedInput);
  const anchors: LegalAnchor[] = [];
  const attorneyRequestActive = hasAttorneyRequestSignals(normalizedSource);
  const attorneyRightsActive = hasAttorneyRightsSignals(normalizedSource);
  const attorneyRequestSanctionActive = hasAttorneyRequestSanctionSignals(normalizedSource);

  if (hasKeyword(normalizedSource, ["маск"])) {
    pushUniqueValues(anchors, ["administrative_offense", "detention_procedure", "sanction"]);
  }

  if (hasKeyword(normalizedSource, ["задерж", "арест", "кпз"])) {
    pushUniqueValues(anchors, ["detention_procedure"]);
  }

  if (attorneyRightsActive) {
    pushUniqueValues(anchors, ["attorney_rights"]);
  }

  if (attorneyRequestActive) {
    pushUniqueValue(anchors, "attorney_request");
  }

  if (attorneyRequestActive && attorneyRequestSanctionActive) {
    pushUniqueValue(anchors, "sanction");
  }

  if (
    hasKeyword(normalizedSource, [
      "бодикам",
      "body-cam",
      "bodycam",
      "видеозапис",
      "видеофиксац",
      "запись задержания",
    ])
  ) {
    pushUniqueValues(anchors, ["video_recording", "official_duty", "evidence"]);
  }

  if (input.intent === "complaint_strategy") {
    pushUniqueValue(anchors, "remedy");
  }

  if (input.intent === "evidence_check") {
    pushUniqueValue(anchors, "evidence");
  }

  if (hasKeyword(normalizedSource, ["исключ", "кроме случаев"])) {
    pushUniqueValue(anchors, "exception");
  }

  return anchors;
}

function deriveRequiredLawFamilies(input: {
  anchors: LegalAnchor[];
  normalizedInput: string;
}) {
  const normalizedSource = normalizeQuestion(input.normalizedInput);
  const families: LawFamily[] = [];
  const attorneyRequestActive = input.anchors.includes("attorney_request");
  const attorneyRequestSanctionActive = hasAttorneyRequestSanctionSignals(normalizedSource);

  for (const anchor of input.anchors) {
    switch (anchor) {
      case "administrative_offense":
      case "sanction":
        if (attorneyRequestActive && attorneyRequestSanctionActive) {
          pushUniqueValue(families, "criminal_code");
        } else {
          pushUniqueValue(families, "administrative_code");
        }
        break;
      case "detention_procedure":
      case "video_recording":
      case "evidence":
        pushUniqueValue(families, "procedural_code");
        break;
      case "attorney_rights":
        pushUniqueValues(families, ["procedural_code", "advocacy_law"]);
        break;
      case "attorney_request":
        pushUniqueValue(families, "advocacy_law");
        break;
      case "official_duty":
        if (!attorneyRequestActive) {
          pushUniqueValues(families, ["government_code", "department_specific"]);
        }
        break;
      case "remedy":
        pushUniqueValues(families, ["procedural_code", "advocacy_law"]);
        break;
      case "exception":
        pushUniqueValue(families, "procedural_code");
        break;
    }
  }

  return families;
}

function derivePreferredNormRoles(input: {
  anchors: LegalAnchor[];
  intent: LegalCoreIntent;
  normalizedInput: string;
}) {
  const normalizedSource = normalizeQuestion(input.normalizedInput);
  const roles: NormRole[] = [];
  const attorneyRequestActive = input.anchors.includes("attorney_request");
  const attorneyRequestSanctionActive = hasAttorneyRequestSanctionSignals(normalizedSource);

  for (const anchor of input.anchors) {
    switch (anchor) {
      case "administrative_offense":
        pushUniqueValues(roles, ["primary_basis", "sanction"]);
        break;
      case "detention_procedure":
        pushUniqueValues(roles, ["primary_basis", "procedure"]);
        break;
      case "attorney_rights":
        pushUniqueValues(roles, ["right_or_guarantee", "procedure"]);
        break;
      case "attorney_request":
        pushUniqueValues(roles, ["primary_basis", "remedy"]);
        break;
      case "video_recording":
        pushUniqueValues(roles, ["procedure", "right_or_guarantee"]);
        break;
      case "official_duty":
        pushUniqueValues(roles, ["primary_basis", "procedure"]);
        break;
      case "sanction":
        if (!attorneyRequestActive || attorneyRequestSanctionActive) {
          pushUniqueValue(roles, "sanction");
        }
        break;
      case "exception":
        pushUniqueValue(roles, "exception");
        break;
      case "remedy":
        pushUniqueValue(roles, "remedy");
        break;
      case "evidence":
        pushUniqueValues(roles, ["procedure", "right_or_guarantee"]);
        break;
    }
  }

  if (input.intent === "law_explanation") {
    pushUniqueValues(roles, ["primary_basis", "right_or_guarantee"]);
  }

  if (input.intent === "qualification_check") {
    pushUniqueValues(roles, ["primary_basis", "sanction"]);
  }

  if (roles.length === 0) {
    pushUniqueValues(roles, ["primary_basis", "procedure"]);
  }

  return roles;
}

function deriveForbiddenScopeMarkers(input: {
  actorContext: LegalCoreActorContext;
  anchors: LegalAnchor[];
}) {
  const markers: string[] = [];

  if (input.actorContext === "general_question") {
    pushUniqueValues(markers, [
      "иммунитет",
      "неприкосновенность",
      "публичное мероприятие",
      "митинг",
      "национальная гвардия",
    ]);
  }

  if (!input.anchors.includes("attorney_request")) {
    pushUniqueValue(markers, "официальный адвокатский запрос");
  }

  return markers;
}

function deriveQuestionScope(actorContext: LegalCoreActorContext): LegalQueryPlan["question_scope"] {
  switch (actorContext) {
    case "self":
      return "self_case";
    case "representative_for_trustor":
      return "representative_case";
    default:
      return "general_question";
  }
}

export function buildLegalQueryPlan(input: {
  normalizedInput: string;
  originalInput?: string;
  intent: LegalCoreIntent;
  actorContext: LegalCoreActorContext;
  responseMode: LegalCoreResponseMode;
  serverId: string;
}) {
  const legalAnchors = buildLegalAnchors({
    normalizedInput: input.normalizedInput,
    intent: input.intent,
  });
  const requiredLawFamilies = deriveRequiredLawFamilies({
    anchors: legalAnchors,
    normalizedInput: input.normalizedInput,
  });
  const preferredNormRoles = derivePreferredNormRoles({
    anchors: legalAnchors,
    intent: input.intent,
    normalizedInput: input.normalizedInput,
  });
  const questionScope = deriveQuestionScope(input.actorContext);
  const forbiddenScopeMarkers = deriveForbiddenScopeMarkers({
    actorContext: input.actorContext,
    anchors: legalAnchors,
  });
  const rawCitations = input.originalInput
    ? parseExplicitLegalCitations(input.originalInput)
    : [];
  const normalizedCitations = parseExplicitLegalCitations(input.normalizedInput);
  const citationMergeResult = mergeExplicitLegalCitations({
    rawCitations,
    normalizedCitations,
  });
  const explicitLegalCitations = citationMergeResult.mergedCitations;
  const citationConstraints = buildCitationConstraints(explicitLegalCitations);
  const citationDiagnostics = buildCitationDiagnostics(citationMergeResult);
  const legalIssueClassification = classifyLegalIssueTypes({
    normalizedInput: input.normalizedInput,
    originalInput: input.originalInput,
    intent: input.intent,
    actorContext: input.actorContext,
    legalAnchors,
    explicitCitations: explicitLegalCitations,
  });
  const retrievalQuery = buildAssistantRetrievalQuery({
    normalized_input: input.normalizedInput,
    intent: input.intent,
    required_law_families: requiredLawFamilies,
    preferred_norm_roles: preferredNormRoles,
    legal_anchors: [...legalAnchors],
    question_scope: questionScope,
    forbidden_scope_markers: forbiddenScopeMarkers,
  });

  return {
    normalized_input: input.normalizedInput,
    intent: input.intent,
    actor_context: input.actorContext,
    response_mode: input.responseMode,
    server_id: input.serverId,
    law_version: "current_snapshot_only",
    question_scope: questionScope,
    legal_anchors: legalAnchors,
    required_law_families: requiredLawFamilies,
    preferred_norm_roles: preferredNormRoles,
    forbidden_scope_markers: forbiddenScopeMarkers,
    expanded_query: retrievalQuery.expanded_query,
    explicitLegalCitations,
    citationConstraints,
    citationDiagnostics,
    primaryLegalIssueType: legalIssueClassification.primaryLegalIssueType,
    secondaryLegalIssueTypes: legalIssueClassification.secondaryLegalIssueTypes,
    legalIssueConfidence: legalIssueClassification.legalIssueConfidence,
    legalIssueDiagnostics: legalIssueClassification.legalIssueDiagnostics,
  } satisfies LegalQueryPlan;
}
