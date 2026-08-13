// Conversa comprador ↔ vendedor, em tempo real.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Text, useTheme } from '@garimpo/ui';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  markConversationRead,
  sendMessage,
  useConversationMessages,
  type Message,
} from '@/features/order/chat';

export default function ChatScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const { messages, setMessages } = useConversationMessages(id);

  useEffect(() => {
    if (session) void markConversationRead(id, session.user.id);
  }, [id, session, messages.length]);

  const send = useMutation({
    mutationFn: (body: string) =>
      sendMessage({ conversationId: id, senderId: session!.user.id, body }),
    onSuccess: (message) => {
      // Eco local imediato; o realtime ignora o id que já está na lista.
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
      listRef.current?.scrollToEnd({ animated: true });
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll={false} style={{ gap: theme.space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={theme.space.md}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text variant="titleLg">Conversa</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerStyle={{ gap: theme.space.sm, paddingBottom: theme.space.lg }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender_id === session?.user.id;
            return (
              <View
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  backgroundColor: mine ? theme.colors.brand.primary : theme.colors.bg.raised,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.space.lg,
                  paddingVertical: theme.space.md,
                }}
              >
                <Text
                  variant="body"
                  style={{ color: mine ? theme.colors.text.onBrand : theme.colors.text.primary }}
                >
                  {item.body}
                </Text>
              </View>
            );
          }}
        />

        <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'flex-end' }}>
          <TextInput
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder="Escreva uma mensagem"
            placeholderTextColor={theme.colors.text.tertiary}
            style={[
              theme.textStyles.body,
              {
                flex: 1,
                maxHeight: 120,
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.bg.raised,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                paddingHorizontal: theme.space.lg,
                paddingVertical: theme.space.md,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
            disabled={!draft.trim() || send.isPending}
            onPress={() => {
              const body = draft.trim();
              if (!body) return;
              setDraft('');
              send.mutate(body);
            }}
            style={{
              width: theme.touchTarget.min,
              height: theme.touchTarget.min,
              borderRadius: theme.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.brand.primary,
              opacity: draft.trim() ? 1 : 0.5,
            }}
          >
            <Ionicons name="arrow-up" size={20} color={theme.colors.text.onBrand} />
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
