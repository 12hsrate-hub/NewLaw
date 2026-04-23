import { z } from "zod";

export const trustorIdSchema = z.string().min(1);

const trustorFormFieldsSchema = z.object({
  fullName: z.string().trim().max(120).default(""),
  passportNumber: z.string().trim().max(64).default(""),
  phone: z.string().trim().max(64).default(""),
  icEmail: z.string().trim().max(320).default(""),
  passportImageUrl: z.string().trim().max(2_048).default(""),
  note: z.string().trim().max(500).default(""),
});

function withTrustorCardValidation<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return schema.superRefine((value, ctx) => {
    if (typeof value !== "object" || value === null) {
      return;
    }

    const trustorValue = value as {
      fullName?: string;
      passportNumber?: string;
      phone?: string;
      icEmail?: string;
      passportImageUrl?: string;
      note?: string;
    };
    const hasAnyValue = [
      trustorValue.fullName ?? "",
      trustorValue.passportNumber ?? "",
      trustorValue.phone ?? "",
      trustorValue.icEmail ?? "",
      trustorValue.passportImageUrl ?? "",
      trustorValue.note ?? "",
    ].some(
      (field) => field.trim().length > 0,
    );

    if (!hasAnyValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fullName"],
        message: "Хотя бы одно поле trustor card должно быть заполнено.",
      });
    }
  });
}

export const trustorFormSchema = withTrustorCardValidation(trustorFormFieldsSchema);

export const createTrustorInputSchema = withTrustorCardValidation(
  trustorFormFieldsSchema.extend({
  accountId: z.string().uuid(),
  serverId: z.string().min(1),
  }),
);

export const updateTrustorInputSchema = withTrustorCardValidation(
  trustorFormFieldsSchema.extend({
  accountId: z.string().uuid(),
  serverId: z.string().min(1),
  trustorId: trustorIdSchema,
  }),
);

export const softDeleteTrustorInputSchema = z.object({
  accountId: z.string().uuid(),
  trustorId: trustorIdSchema,
});

export type CreateTrustorInput = z.infer<typeof createTrustorInputSchema>;
export type UpdateTrustorInput = z.infer<typeof updateTrustorInputSchema>;
export type SoftDeleteTrustorInput = z.infer<typeof softDeleteTrustorInputSchema>;
