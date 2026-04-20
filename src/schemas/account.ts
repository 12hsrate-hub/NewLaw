import { z } from "zod";

export const accountIdentitySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

export type AccountIdentityInput = z.infer<typeof accountIdentitySchema>;
