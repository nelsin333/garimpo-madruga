import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CONFIDENCE_LABELS,
  VERDICT_OUTCOME_LABELS,
  type Confidence,
  type VerdictOutcome,
} from '@garimpo/contracts';
import type { RiskLevel } from '@garimpo/db';
import {
  Button,
  Card,
  RiskBadge,
  Screen,
  ScoreRing,
  Text,
  VerifiedShield,
  useTheme,
} from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';
import { fetchReport } from '@/features/check/api';
import { FindingCard } from '@/features/check/components/FindingCard';
import { MarkdownLite } from '@/features/check/components/MarkdownLite';

export default function ReportScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: report, isPending } = useQuery({
    queryKey: ['check-report', id],
    queryFn: () => fetchReport(id),
  });

  if (isPending || !report) {
    return (
      <Screen scroll={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </Screen>
    );
  }

  const { verdict, findings, certificate, photoUrls, photoRegionById, check } = report;
  const pieceName =
    [check.brandName, check.modelName].filter(Boolean).join(' ') || 'Peça analisada';

  if (!verdict) {
    return (
      <Screen>
        <ReportHeader title="Laudo" />
        <Card style={{ gap: theme.space.md }}>
          <Text color="secondary">O laudo desta análise ainda não está disponível.</Text>
          <Button variant="secondary" title="Voltar" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  const outcome = verdict.outcome as VerdictOutcome;
  const probability = Number(verdict.authenticity_probability);
  const positives = findings.filter((f) => f.polarity === 'positive');
  const suspicious = findings.filter((f) => f.polarity === 'suspicious');
  const graded = findings.filter((f) => f.polarity !== 'neutral');
  const inconclusive = findings.filter((f) => f.polarity === 'neutral');

  const outcomeColor =
    outcome === 'original'
      ? theme.colors.risk.low
      : outcome === 'replica'
        ? theme.colors.risk.high
        : theme.colors.risk.inconclusive;

  async function share() {
    const lines = [
      `Legit Check — ${pieceName}`,
      `${Math.round(probability * 100)}% de probabilidade de autenticidade · ${VERDICT_OUTCOME_LABELS[outcome]}`,
      certificate ? `Certificado: ${certificate.public_code}` : null,
      'Análise probabilística feita no Garimpo Madruga.',
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') });
  }

  return (
    <Screen>
      <ReportHeader title={`Laudo · ${check.categoryName ?? ''}`} />

      {/* Hero */}
      <View style={{ alignItems: 'center', gap: theme.space.lg }}>
        <ScoreRing score={probability} risk={verdict.risk as RiskLevel} size={172} />
        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <Text variant="titleLg" style={{ color: outcomeColor }}>
            {VERDICT_OUTCOME_LABELS[outcome]}
          </Text>
          <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
            {pieceName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
            <RiskBadge risk={verdict.risk as RiskLevel} />
            <Text variant="caption" color="secondary">
              {CONFIDENCE_LABELS[verdict.confidence as Confidence]}
            </Text>
          </View>
        </View>
      </View>

      {certificate && !certificate.revoked ? (
        <Card
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: `${theme.colors.brand.primary}55`,
          }}
        >
          <View style={{ gap: 2 }}>
            <VerifiedShield />
            <Text variant="monoSm" color="secondary">
              {certificate.public_code}
            </Text>
          </View>
          <Button variant="secondary" size="md" title="Salvar" onPress={() => void share()} />
        </Card>
      ) : null}

      {/* Resumo */}
      <Section title="Resumo da análise">
        <Card style={{ gap: theme.space.md }}>
          <View style={{ flexDirection: 'row', gap: theme.space['2xl'] }}>
            <Stat label="Evidências" value={String(findings.length)} />
            <Stat label="Conferem" value={String(positives.length)} accent="success" />
            <Stat label="Atenção" value={String(suspicious.length)} accent="warning" />
          </View>
          <MarkdownLite text={verdict.summary_md} />
        </Card>
      </Section>

      {/* Evidências */}
      <Section title={`Itens analisados (${graded.length})`}>
        <View style={{ gap: theme.space.md }}>
          {graded.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              photoUrl={
                photoUrls[
                  finding.photo_id
                    ? (photoRegionById[finding.photo_id] ?? finding.region)
                    : finding.region
                ]
              }
            />
          ))}
        </View>
      </Section>

      {inconclusive.length > 0 ? (
        <Section title={`Itens inconclusivos (${inconclusive.length})`}>
          <View style={{ gap: theme.space.md }}>
            {inconclusive.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                photoUrl={
                  photoUrls[
                    finding.photo_id
                      ? (photoRegionById[finding.photo_id] ?? finding.region)
                      : finding.region
                  ]
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      {verdict.recommendations_md ? (
        <Section title="Recomendações">
          <Card>
            <MarkdownLite text={verdict.recommendations_md} />
          </Card>
        </Section>
      ) : null}

      {verdict.next_steps_md ? (
        <Section title="Próximos passos">
          <Card>
            <MarkdownLite text={verdict.next_steps_md} />
          </Card>
        </Section>
      ) : null}

      <Button title="Compartilhar laudo" onPress={() => void share()} />

      <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
        ⓘ Análise probabilística baseada nas fotos enviadas e em referências catalogadas. Não é
        garantia absoluta de autenticidade.
      </Text>
    </Screen>
  );
}

function ReportHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={theme.space.md}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      >
        <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
      </Pressable>
      <Text variant="title">{title}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.md }}>
      <Text variant="caption" color="tertiary">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'success' | 'warning';
}) {
  const theme = useTheme();
  const color = accent ? theme.colors.feedback[accent] : theme.colors.text.primary;
  return (
    <View style={{ gap: 2 }}>
      <Text variant="titleLg" style={{ color }}>
        {value}
      </Text>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
    </View>
  );
}
