import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido');

export const passwordSchema = z.string().min(8, 'A senha precisa de pelo menos 8 caracteres');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type SignUpInput = z.infer<typeof signUpSchema>;
