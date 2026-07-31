import { EmptyState, Screen, Text } from '@garimpo/ui';
import { router } from 'expo-router';

export default function Saved() {
  return (
    <Screen>
      <Text variant="titleLg">Salvos</Text>
      <EmptyState
        title="Nada salvo ainda"
        description="Favoritos e listas de desejo chegam junto com o marketplace."
        action={{ title: 'Explorar marcas', onPress: () => router.push('/(tabs)/search') }}
      />
    </Screen>
  );
}
