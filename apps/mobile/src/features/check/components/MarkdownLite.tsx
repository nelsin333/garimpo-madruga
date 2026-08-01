import { Text, useTheme } from '@garimpo/ui';
import { View } from 'react-native';

/**
 * Renderizador mínimo para os textos markdown do laudo (parágrafos,
 * "- " bullets e "1." listas numeradas). Suficiente para o conteúdo que o
 * pipeline gera; trocamos por um renderer completo se o laudo evoluir.
 */
export function MarkdownLite({ text }: { text: string }) {
  const theme = useTheme();
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  return (
    <View style={{ gap: theme.space.sm }}>
      {lines.map((line, i) => {
        const bullet = line.match(/^\s*-\s+(.*)$/);
        const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (bullet) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: theme.space.sm }}>
              <Text color="brand">•</Text>
              <Text color="secondary" style={{ flex: 1 }}>
                {bullet[1]}
              </Text>
            </View>
          );
        }
        if (numbered) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: theme.space.sm }}>
              <Text color="brand" variant="bodyMedium">
                {numbered[1]}.
              </Text>
              <Text color="secondary" style={{ flex: 1 }}>
                {numbered[2]}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} color="secondary">
            {line}
          </Text>
        );
      })}
    </View>
  );
}
