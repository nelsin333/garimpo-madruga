import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
}

/** Input com label e erro — o campo de formulário padrão do app. */
export function Field({ label, error, style, onFocus, onBlur, ...rest }: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.feedback.danger
    : focused
      ? theme.colors.brand.primary
      : theme.colors.border.subtle;

  return (
    <View style={{ gap: theme.space.sm }}>
      <Text variant="caption" color="secondary">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={theme.colors.text.tertiary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
        style={[
          theme.textStyles.body,
          {
            color: theme.colors.text.primary,
            backgroundColor: theme.colors.bg.raised,
            borderWidth: 1,
            borderColor,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space.lg,
            height: 52,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
