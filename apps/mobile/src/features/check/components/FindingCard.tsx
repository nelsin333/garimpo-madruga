import Ionicons from '@expo/vector-icons/Ionicons';
import { bboxSchema, type BBox } from '@garimpo/contracts';
import type { Tables } from '@garimpo/db';
import { Card, Text, useTheme } from '@garimpo/ui';
import { View } from 'react-native';
import { z } from 'zod';
import { BBoxImage } from './BBoxImage';

const comparisonSchema = z.object({
  similarity_authentic: z.number().nullable(),
  similarity_replica: z.number().nullable(),
  n_authentic: z.number(),
  n_replica: z.number(),
});

export interface FindingCardProps {
  finding: Tables<'check_findings'>;
  photoUrl: string | undefined;
}

/** Evidência do laudo: foto com bbox + título + análise + comparação + conclusão. */
export function FindingCard({ finding, photoUrl }: FindingCardProps) {
  const theme = useTheme();
  const polarity = finding.polarity;
  const accent =
    polarity === 'suspicious'
      ? theme.colors.feedback.warning
      : polarity === 'positive'
        ? theme.colors.feedback.success
        : theme.colors.text.tertiary;

  let bbox: BBox | null = null;
  const parsedBBox = bboxSchema.safeParse(finding.bbox);
  if (parsedBBox.success) bbox = parsedBBox.data;

  const parsedComparison = comparisonSchema.safeParse(finding.comparison);
  const comparison = parsedComparison.success ? parsedComparison.data : null;

  return (
    <Card style={{ gap: theme.space.md, padding: theme.space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${accent}22`,
          }}
        >
          <Ionicons
            name={
              polarity === 'suspicious' ? 'alert' : polarity === 'positive' ? 'checkmark' : 'remove'
            }
            size={16}
            color={accent}
          />
        </View>
        <Text variant="bodyMedium" style={{ flex: 1 }}>
          {finding.title}
        </Text>
      </View>

      {photoUrl ? <BBoxImage uri={photoUrl} bbox={bbox} color={accent} /> : null}

      <Text color="secondary">{finding.detail_md}</Text>

      {comparison && (comparison.n_authentic > 0 || comparison.n_replica > 0) ? (
        <View
          style={{
            flexDirection: 'row',
            gap: theme.space['2xl'],
            backgroundColor: theme.colors.bg.overlay,
            borderRadius: theme.radius.md,
            padding: theme.space.md,
          }}
        >
          <SimilarityStat
            label={`Originais (${comparison.n_authentic})`}
            value={comparison.similarity_authentic}
            color={theme.colors.risk.low}
          />
          <SimilarityStat
            label={`Réplicas (${comparison.n_replica})`}
            value={comparison.similarity_replica}
            color={theme.colors.risk.high}
          />
        </View>
      ) : null}

      {finding.conclusion_md ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            backgroundColor: theme.colors.bg.overlay,
            borderRadius: theme.radius.md,
            padding: theme.space.md,
          }}
        >
          <Ionicons name="analytics-outline" size={14} color={accent} />
          <Text variant="caption" style={{ color: accent, flex: 1 }}>
            {finding.conclusion_md}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function SimilarityStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: value != null ? color : theme.colors.text.tertiary }}
      >
        {value != null ? `${Math.round(value * 100)}% similar` : 'sem referências'}
      </Text>
    </View>
  );
}
