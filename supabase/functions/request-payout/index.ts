// Saque do saldo disponível do vendedor. Entrada: { amount_cents }.
//
// Toda a validação (KYC aprovado, valor positivo, saldo suficiente, débito
// atômico) vive em request_payout no banco — aqui só autenticamos e traduzimos
// o erro. O saldo nunca vem do cliente.
import { corsHeaders, json, serviceClient } from '../_shared/client.ts';
import { requireUser } from '../_shared/auth.ts';

const ERROR_STATUS: Record<string, number> = {
  seller_account_not_found: 404,
  kyc_not_approved: 403,
  invalid_amount: 400,
  insufficient_balance: 409,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let amountCents: unknown;
  try {
    ({ amount_cents: amountCents } = await req.json());
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!Number.isInteger(amountCents) || (amountCents as number) <= 0) {
    return json({ error: 'invalid_amount' }, 400);
  }

  const service = serviceClient();
  const { data: payoutId, error } = await service.rpc('request_payout', {
    p_profile_id: user.id,
    p_amount_cents: amountCents,
  });

  if (error) {
    for (const [code, status] of Object.entries(ERROR_STATUS)) {
      if (error.message.includes(code)) return json({ error: code }, status);
    }
    return json({ error: error.message }, 500);
  }

  const { data: payout } = await service
    .from('payouts')
    .select('id, amount_cents, status, requested_at')
    .eq('id', payoutId)
    .maybeSingle();

  return json({ payout }, 201);
});
