import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (!loading && session) {
    return <Redirect href="/(tabs)" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
