import { z } from 'zod';

/** Mesma regra do CHECK constraint em profiles.username. */
export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_.]{3,30}$/, 'Use 3–30 caracteres: letras minúsculas, números, "_" ou "."');

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  display_name: z.string().min(1).max(60).optional(),
  bio: z.string().max(280).optional(),
  avatar_url: z.string().url().optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
