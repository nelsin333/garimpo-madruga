import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const sb = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { persistSession: false },
});

// --- bot_config (chave/valor editavel pelo dashboard) ---

export async function getConfig(chave, fallback = null) {
  const { data } = await sb.from('bot_config').select('valor').eq('chave', chave).maybeSingle();
  const valor = data?.valor?.trim();
  return valor ? valor : fallback;
}

// --- conversas (estado do papo) ---

export async function getConversa(whatsapp) {
  const { data } = await sb.from('conversas').select('*').eq('whatsapp', whatsapp).maybeSingle();
  return data || { whatsapp, estado: 'inicio', contexto: {}, escalada: false };
}

export async function setConversa(whatsapp, campos) {
  await sb
    .from('conversas')
    .upsert({ whatsapp, ...campos, atualizado_em: new Date().toISOString() });
}

// --- mensagens (historico pro escalonamento) ---

export async function salvarMensagem(whatsapp, origem, texto) {
  await sb.from('mensagens').insert({ whatsapp, origem, texto });
}

export async function ultimasMensagens(whatsapp, limite = 10) {
  const { data } = await sb
    .from('mensagens')
    .select('origem, texto, criado_em')
    .eq('whatsapp', whatsapp)
    .order('criado_em', { ascending: false })
    .limit(limite);
  return (data || []).reverse();
}

// --- clientes ---

export async function getCliente(whatsapp) {
  const { data } = await sb.from('clientes').select('*').eq('whatsapp', whatsapp).maybeSingle();
  return data;
}

export async function upsertCliente(whatsapp, campos) {
  await sb.from('clientes').upsert({ whatsapp, ...campos }, { onConflict: 'whatsapp' });
}
