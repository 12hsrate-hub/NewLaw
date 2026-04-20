import { z } from "zod";

import { accountLoginSchema } from "@/schemas/account-security";

export const accountIdentitySchema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
});

export const accountReconciliationSchema = accountIdentitySchema.extend({
  login: accountLoginSchema.optional(),
});

export const pendingEmailStateSchema = z.object({
  accountId: z.string().uuid(),
  pendingEmail: z.string().trim().toLowerCase().email().nullable(),
  requestedAt: z.date().nullable(),
});

export const mustChangePasswordStateSchema = z.object({
  accountId: z.string().uuid(),
  mustChangePassword: z.boolean(),
  reason: z.enum(["admin_reset", "security_policy"]).nullable(),
  changedAt: z.date().nullable().optional(),
});

export type AccountIdentityInput = z.infer<typeof accountIdentitySchema>;
export type AccountReconciliationInput = z.infer<typeof accountReconciliationSchema>;
export type PendingEmailStateInput = z.infer<typeof pendingEmailStateSchema>;
export type MustChangePasswordStateInput = z.infer<typeof mustChangePasswordStateSchema>;
