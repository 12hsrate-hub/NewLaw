import { prisma } from "@/db/prisma";
import type { AILegalCoreTestScenario } from "@/server/legal-core/test-scenarios-registry";

export async function syncAITestScenarios(input: {
  scenarios: AILegalCoreTestScenario[];
}) {
  await prisma.$transaction(
    input.scenarios.map((scenario) =>
      prisma.aITestScenario.upsert({
        where: {
          id: scenario.id,
        },
        create: {
          id: scenario.id,
          title: scenario.title,
          inputText: scenario.inputText,
          expectedBehavior: scenario.expectedBehavior,
          scenarioGroup: scenario.scenarioGroup,
          intent: scenario.intent,
          actorContext: scenario.actorContext,
          answerMode: scenario.answerMode,
          targetFlow: scenario.targetFlow,
          isActive: scenario.isActive,
        },
        update: {
          title: scenario.title,
          inputText: scenario.inputText,
          expectedBehavior: scenario.expectedBehavior,
          scenarioGroup: scenario.scenarioGroup,
          intent: scenario.intent,
          actorContext: scenario.actorContext,
          answerMode: scenario.answerMode,
          targetFlow: scenario.targetFlow,
          isActive: scenario.isActive,
        },
      }),
    ),
  );
}

export async function createAITestRun(input: {
  id: string;
  startedByAccountId: string;
  serverId: string;
  lawVersion: string;
  status?: "running" | "success" | "failure";
  startedAt?: Date;
}) {
  return prisma.aITestRun.create({
    data: {
      id: input.id,
      startedByAccountId: input.startedByAccountId,
      serverId: input.serverId,
      lawVersion: input.lawVersion,
      status: input.status ?? "running",
      startedAt: input.startedAt ?? new Date(),
    },
  });
}

export async function completeAITestRun(input: {
  id: string;
  status: "success" | "failure";
  completedAt: Date;
}) {
  return prisma.aITestRun.update({
    where: {
      id: input.id,
    },
    data: {
      status: input.status,
      completedAt: input.completedAt,
    },
  });
}

export async function createAITestRunResult(input: {
  testRunId: string;
  testScenarioId: string;
  aiGenerationId?: string | null;
  status: "success" | "failure" | "unavailable";
  riskLevel?: string | null;
  passedBasicChecks: boolean;
  sentToReview: boolean;
}) {
  return prisma.aITestRunResult.create({
    data: {
      testRunId: input.testRunId,
      testScenarioId: input.testScenarioId,
      aiGenerationId: input.aiGenerationId ?? null,
      status: input.status,
      riskLevel: input.riskLevel ?? null,
      passedBasicChecks: input.passedBasicChecks,
      sentToReview: input.sentToReview,
    },
  });
}
