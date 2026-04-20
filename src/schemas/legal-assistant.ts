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
  .max(3000, "Вопрос слишком длинный для MVP-формата.");

export const assistantQuestionInputSchema = z.object({
  serverSlug: assistantServerSlugSchema,
  question: assistantQuestionSchema,
});

export const assistantGuestTokenSchema = z.string().trim().min(16).max(128);

export const aiProxyProviderSchema = z.enum(["openai_compatible"]);

export const aiProxyConfigEntrySchema = z.object({
  key: z.string().trim().min(1).max(64),
  provider: aiProxyProviderSchema.default("openai_compatible"),
  endpointUrl: z.string().url(),
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1),
  isEnabled: z.boolean().default(true),
  timeoutMs: z.number().int().positive().max(120000).optional(),
  extraHeaders: z.record(z.string(), z.string()).optional(),
});

export const aiProxyConfigListSchema = z.array(aiProxyConfigEntrySchema).max(10);

export type AssistantQuestionInput = z.infer<typeof assistantQuestionInputSchema>;
export type AIProxyConfigEntry = z.infer<typeof aiProxyConfigEntrySchema>;
