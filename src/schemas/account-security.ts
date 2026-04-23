import { z } from "zod";

export const reservedAccountLogins = [
  "admin",
  "root",
  "support",
  "api",
  "auth",
  "login",
  "logout",
  "sign-in",
  "sign-up",
  "app",
  "security",
  "settings",
  "docs",
  "forum",
  "ai",
  "test",
  "system",
  "null",
  "undefined",
  "me",
] as const;

const accountLoginPattern = /^[a-z0-9_]{3,32}$/;

export const accountLoginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(accountLoginPattern, "Логин должен содержать от 3 до 32 символов: латиницу, цифры и нижнее подчёркивание.")
  .refine(
    (value) => !reservedAccountLogins.includes(value as (typeof reservedAccountLogins)[number]),
    "Этот логин зарезервирован системой.",
  );

export const accountLoginCandidateSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(accountLoginPattern, "Некорректный логин.");

export const accountIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Укажите email или логин.")
  .refine((value) => {
    const normalizedValue = value.toLowerCase();

    return z.string().email().safeParse(normalizedValue).success || accountLoginCandidateSchema.safeParse(normalizedValue).success;
  }, "Укажите email или логин в корректном формате.");

export const adminAccountSearchIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Укажите email, логин или ID аккаунта.")
  .refine((value) => {
    const normalizedValue = value.toLowerCase();

    return (
      z.string().email().safeParse(normalizedValue).success ||
      z.string().uuid().safeParse(value).success ||
      accountLoginCandidateSchema.safeParse(normalizedValue).success
    );
  }, "Укажите корректный email, логин или ID аккаунта.");

const passwordResetBaseSchema = z.object({
  newPassword: z
    .string()
  .min(8, "Пароль должен содержать минимум 8 символов.")
  .max(72, "Пароль слишком длинный."),
  confirmNewPassword: z.string().min(1, "Подтвердите новый пароль."),
});

export const resetPasswordInputSchema = passwordResetBaseSchema.refine(
  (value) => value.newPassword === value.confirmNewPassword,
  {
    path: ["confirmNewPassword"],
    message: "Пароли должны совпадать.",
  },
);

export const changePasswordInputSchema = passwordResetBaseSchema
  .extend({
    currentPassword: z.string().min(1, "Укажите текущий пароль."),
  })
  .refine((value) => value.newPassword === value.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Пароли должны совпадать.",
  });

export const changeEmailInputSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email("Укажите корректный email."),
  currentPassword: z.string().min(1, "Укажите текущий пароль."),
});

export const adminSecurityInputBaseSchema = z.object({
  actorAccountId: z.string().uuid(),
  targetAccountId: z.string().uuid(),
  comment: z.string().trim().min(3, "Комментарий должен содержать минимум 3 символа.").max(500),
});

export const adminSecurityUiInputBaseSchema = z.object({
  targetAccountId: z.string().uuid(),
  comment: z.string().trim().min(3, "Комментарий должен содержать минимум 3 символа.").max(500),
});

export const adminChangeEmailInputSchema = adminSecurityInputBaseSchema.extend({
  newEmail: z.string().trim().toLowerCase().email("Укажите корректный email."),
});

export const adminChangeEmailUiInputSchema = adminSecurityUiInputBaseSchema.extend({
  newEmail: z.string().trim().toLowerCase().email("Укажите корректный email."),
});

export type AccountLogin = z.infer<typeof accountLoginSchema>;
export type ForgotPasswordIdentifier = z.infer<typeof accountIdentifierSchema>;
export type AdminAccountSearchIdentifier = z.infer<typeof adminAccountSearchIdentifierSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailInputSchema>;
export type AdminSecurityInputBase = z.infer<typeof adminSecurityInputBaseSchema>;
export type AdminChangeEmailInput = z.infer<typeof adminChangeEmailInputSchema>;
export type AdminSecurityUiInputBase = z.infer<typeof adminSecurityUiInputBaseSchema>;
export type AdminChangeEmailUiInput = z.infer<typeof adminChangeEmailUiInputSchema>;
