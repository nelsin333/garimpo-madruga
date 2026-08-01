import { Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchMyRole } from '@/features/reference/api';

/** Área restrita a perfis expert/admin (catalogação do acervo). */
export default function ExpertLayout() {
  const theme = useTheme();
  const { session, loading } = useAuth();

  const { data: role, isPending } = useQuery({
    queryKey: ['my-role', session?.user.id],
    enabled: !!session,
    queryFn: () => fetchMyRole(session!.user.id),
  });

  if (loading || (session && isPending)) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role !== 'expert' && role !== 'admin') {
    return (
      <Screen scroll={false} style={{ justifyContent: 'center' }}>
        <Text variant="titleLg" style={{ textAlign: 'center' }}>
          Área restrita
        </Text>
        <Text color="secondary" style={{ textAlign: 'center' }}>
          O modo especialista é liberado para autenticadores credenciados.
        </Text>
      </Screen>
    );
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
