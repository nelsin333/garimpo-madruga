import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@garimpo/ui';
import { useAuth } from '@/features/auth/AuthProvider';

export default function Index() {
  const { session, loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bg.base,
        }}
      >
        <ActivityIndicator color={theme.colors.brand.primary} />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)' : '/(auth)/sign-in'} />;
}
