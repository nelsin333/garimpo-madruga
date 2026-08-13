// Autenticação das rotas transacionais. O id do usuário vem sempre do JWT
// verificado pelo Supabase — nunca do corpo da requisição.

import { userClient } from './client.ts';

export interface AuthedUser {
  id: string;
  email: string | null;
}

/** Devolve o usuário do JWT, ou null se o token estiver ausente/inválido. */
export async function requireUser(req: Request): Promise<AuthedUser | null> {
  if (!req.headers.get('Authorization')) return null;
  const { data, error } = await userClient(req).auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
