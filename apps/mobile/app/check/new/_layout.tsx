import { useTheme } from '@garimpo/ui';
import { Stack } from 'expo-router';

export default function NewCheckLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.bg.base },
      }}
    />
  );
}
