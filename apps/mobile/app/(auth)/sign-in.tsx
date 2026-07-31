import { signInSchema } from '@garimpo/contracts';
import { Button, Field, Screen, Text, useTheme } from '@garimpo/ui';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { isAppleCancel, signInWithApple, signInWithGoogle } from '@/features/auth/oauth';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState<'email' | 'google' | 'apple' | null>(null);

  async function handleEmailSignIn() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setErrors({});
    setPending('email');
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setPending(null);
    if (error) {
      Alert.alert('Não foi possível entrar', 'Confira seu e-mail e senha.');
    }
    // sucesso: AuthProvider atualiza a sessão e o (auth)/_layout redireciona
  }

  async function handleGoogle() {
    setPending('google');
    try {
      await signInWithGoogle();
    } catch {
      Alert.alert('Não foi possível entrar com Google', 'Tente novamente.');
    } finally {
      setPending(null);
    }
  }

  async function handleApple() {
    setPending('apple');
    try {
      await signInWithApple();
    } catch (e) {
      if (!isAppleCancel(e)) {
        Alert.alert('Não foi possível entrar com Apple', 'Tente novamente.');
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={{ gap: theme.space.sm, marginBottom: theme.space.xl }}>
        <Text variant="displayXl">garimpo{'\n'}madruga</Text>
        <Text color="secondary">Se tem selo, é real.</Text>
      </View>

      <View style={{ gap: theme.space.lg }}>
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="voce@exemplo.com"
        />
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <Button title="Entrar" onPress={handleEmailSignIn} loading={pending === 'email'} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border.subtle }} />
        <Text variant="caption" color="tertiary">
          ou
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border.subtle }} />
      </View>

      <View style={{ gap: theme.space.md }}>
        <Button
          variant="secondary"
          title="Continuar com Google"
          onPress={handleGoogle}
          loading={pending === 'google'}
        />
        {Platform.OS === 'ios' ? (
          <Button
            variant="secondary"
            title="Continuar com Apple"
            onPress={handleApple}
            loading={pending === 'apple'}
          />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.space.xs }}>
        <Text color="secondary">Primeira vez por aqui?</Text>
        <Link href="/(auth)/sign-up">
          <Text color="brand">Criar conta</Text>
        </Link>
      </View>
    </Screen>
  );
}
