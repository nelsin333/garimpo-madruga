import { Button, Card, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function Profile() {
  const theme = useTheme();
  const { session, signOut } = useAuth();

  const { data: profile, isPending } = useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, bio, level, reputation_score, role')
        .eq('id', session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Screen>
      <Text variant="titleLg">Perfil</Text>

      {isPending ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : profile ? (
        <Card style={{ gap: theme.space.md }}>
          <View style={{ gap: 2 }}>
            <Text variant="title">{profile.display_name ?? profile.username}</Text>
            <Text variant="monoSm" color="secondary">
              @{profile.username}
            </Text>
          </View>
          {profile.bio ? <Text color="secondary">{profile.bio}</Text> : null}
          <View style={{ flexDirection: 'row', gap: theme.space['2xl'] }}>
            <View>
              <Text variant="caption" color="tertiary">
                Nível
              </Text>
              <Text variant="bodyMedium">{profile.level}</Text>
            </View>
            <View>
              <Text variant="caption" color="tertiary">
                Reputação
              </Text>
              <Text variant="bodyMedium">{Number(profile.reputation_score).toFixed(1)}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: theme.space.xs }}>
        <Text variant="caption" color="tertiary">
          Conta
        </Text>
        <Text color="secondary">{session?.user.email}</Text>
      </Card>

      {profile && (profile.role === 'expert' || profile.role === 'admin') ? (
        <Button
          variant="secondary"
          title="🛡️  Modo especialista"
          onPress={() => router.push('/expert')}
        />
      ) : null}

      <Button variant="secondary" title="Sair" onPress={() => void signOut()} />
    </Screen>
  );
}
