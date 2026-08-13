// Chat comprador ↔ vendedor.
//
// A conversa é criada uma vez por (anúncio, comprador) — o unique da tabela
// garante isso mesmo com dois toques simultâneos. A RLS restringe leitura e
// escrita às duas partes; o app não precisa filtrar de novo.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  order_id: string | null;
  last_message_at: string | null;
}

/** Abre (ou reaproveita) a conversa daquele anúncio com aquele comprador. */
export async function openConversation(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  orderId?: string | null;
}): Promise<Conversation> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, order_id, last_message_at')
    .eq('listing_id', input.listingId)
    .eq('buyer_id', input.buyerId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      listing_id: input.listingId,
      buyer_id: input.buyerId,
      seller_id: input.sellerId,
      order_id: input.orderId ?? null,
    })
    .select('id, listing_id, buyer_id, seller_id, order_id, last_message_at')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      body: input.body.trim().slice(0, 2000),
    })
    .select('id, conversation_id, sender_id, body, read_at, created_at')
    .single();
  if (error) throw error;
  return data;
}

/** Marca como lidas as mensagens do outro lado (a RLS só permite essas). */
export async function markConversationRead(
  conversationId: string,
  readerId: string,
): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', readerId)
    .is('read_at', null);
}

export async function countUnread(profileId: string): Promise<number> {
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .or(`buyer_id.eq.${profileId},seller_id.eq.${profileId}`);
  const ids = (conversations ?? []).map((row) => row.id);
  if (ids.length === 0) return 0;

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', ids)
    .neq('sender_id', profileId)
    .is('read_at', null);
  return count ?? 0;
}

/**
 * Assina as mensagens novas da conversa. Devolve a lista já ordenada e um
 * `append` local para eco imediato do que o próprio usuário envia.
 */
export function useConversationMessages(conversationId: string | null): {
  messages: Message[];
  setMessages: (updater: (current: Message[]) => Message[]) => void;
} {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;

    void fetchMessages(conversationId).then((initial) => {
      if (active) setMessages(initial);
    });

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) =>
            // O remetente já inseriu localmente: não duplicamos pelo realtime.
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming],
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { messages, setMessages: (updater) => setMessages((current) => updater(current)) };
}
