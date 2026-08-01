import Ionicons from '@expo/vector-icons/Ionicons';
import { bboxSchema, type BBox } from '@garimpo/contracts';
import type { Tables } from '@garimpo/db';
import { Card, Text, useTheme } from '@garimpo/ui';
import { View } from 'react-native';
import { BBoxImage } from './BBoxImage';

export interface FindingCardProps {
  finding: Tables<'check_findings'>;
  photoUrl: string | undefined;
}

/** Evidência do laudo: foto com bbox + título + análise + conclusão. */
export function FindingCard({ finding, photoUrl }: FindingCardProps) {
  const theme = useTheme();
  const suspicious = finding.polarity === 'suspicious';
  const accent = suspicious ? theme.colors.feedback.warning : theme.colors.feedback.success;

  let bbox: BBox | null = null;
  const parsed = bboxSchema.safeParse(finding.bbox);
  if (parsed.success) bbox = parsed.data;

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
            name={suspicious ? 'alert' : 'checkmark'}
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
