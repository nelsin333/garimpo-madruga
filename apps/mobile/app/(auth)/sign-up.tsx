import { signUpSchema } from '@garimpo/contracts';
import { Button, Field, Screen, Text, useTheme } from '@garimpo/ui';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);

  async function handleSignUp() {
    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setErrors({});
    setPending(true);
    const { data, error } = await supabase.auth.signUp(parsed.data);
    setPending(false);

    if (error) {
      Alert.alert('Não foi possível criar a conta', error.message);
      return;
    }
    if (data.session) {
      // confirmação de e-mail desativada: já entra direto
      return;
    }
    Alert.alert('Confirme seu e-mail', 'Enviamos um link de confirmação para você.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={{ gap: theme.space.sm, marginBottom: theme.space.xl }}>
        <Text variant="titleLg">Criar conta</Text>
        <Text color="secondary">Autentique, valorize e venda suas peças.</Text>
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
          autoComplete="new-password"
          placeholder="mínimo 8 caracteres"
        />
        <Button title="Criar conta" onPress={handleSignUp} loading={pending} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.space.xs }}>
        <Text color="secondary">Já tem conta?</Text>
        <Link href="/(auth)/sign-in">
          <Text color="brand">Entrar</Text>
        </Link>
      </View>
    </Screen>
  );
}
