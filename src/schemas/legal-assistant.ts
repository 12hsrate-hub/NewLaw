import { z } from "zod";

export const assistantServerSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i);

export const assistantQuestionSchema = z
  .string()
  .trim()
  .min(6, "Сформулируй вопрос чуть подробнее.")
  .max(1500, "Вопрос слишком длинный для assistant MVP.");

export const assistantActorContextSchema = z.enum([
  "self",
  "representative_for_trustor",
  "general_question",
]);

export const assistantQuestionInputSchema = z.object({
  serverSlug: assistantServerSlugSchema,
  question: assistantQuestionSchema,
  actorContext: assistantActorContextSchema.default("general_question"),
});

export const assistantGuestTokenSchema = z.string().trim().min(16).max(128);

export const aiProxyProviderSchema = z.enum(["openai_compatible"]);

export const aiProxyConfigEntrySchema = z.object({
  proxyKey: z.string().trim().min(1).max(64),
  providerKey: aiProxyProviderSchema.default("openai_compatible"),
  endpointUrl: z.string().url(),
  secretEnvKeyName: z.string().trim().min(1).max(128),
  model: z.string().trim().min(1),
  isEnabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(100),
  weight: z.number().int().min(1).max(1000).default(1),
  timeoutMs: z.number().int().positive().max(120000).optional(),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
});

export const aiProxyConfigListSchema = z.array(aiProxyConfigEntrySchema).max(10);

export type AssistantQuestionInput = z.infer<typeof assistantQuestionInputSchema>;
export type AIProxyConfigEntry = z.infer<typeof aiProxyConfigEntrySchema>;
