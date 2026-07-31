import { View } from 'react-native';
import { useTheme } from '../theme';
import { Button, type ButtonProps } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: Pick<ButtonProps, 'title' | 'onPress'>;
}

/** Estado vazio sempre com uma ação — nunca um beco sem saída. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: theme.space.md, paddingVertical: theme.space['4xl'] }}>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {description ? (
        <Text color="secondary" style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
      {action ? (
        <Button
          variant="secondary"
          size="md"
          title={action.title}
          onPress={action.onPress}
          style={{ marginTop: theme.space.md }}
        />
      ) : null}
    </View>
  );
}
