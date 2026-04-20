import { z } from "zod";

import { accountIdentifierSchema, accountLoginSchema } from "@/schemas/account-security";

export const authEmailSchema = z.string().trim().email().max(160);
export const authPasswordSchema = z
  .string()
  .min(8, "Пароль должен содержать минимум 8 символов.")
  .max(72, "Пароль слишком длинный.");

export const signInInputSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema,
});

export const signInIdentifierInputSchema = z.object({
  identifier: accountIdentifierSchema,
  password: authPasswordSchema,
});

export const signUpInputSchema = z.object({
  login: accountLoginSchema,
  email: authEmailSchema,
  password: authPasswordSchema,
});

export type SignInInput = z.infer<typeof signInInputSchema>;
export type SignInIdentifierInput = z.infer<typeof signInIdentifierInputSchema>;
export type SignUpInput = z.infer<typeof signUpInputSchema>;
