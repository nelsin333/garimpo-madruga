import Ionicons from '@expo/vector-icons/Ionicons';
import { VERDICT_OUTCOME_LABELS, type VerdictOutcome } from '@garimpo/contracts';
import type { CheckStatus } from '@garimpo/db';
import { Chip, EmptyState, Field, PressableCard, Screen, Text, useTheme } from '@garimpo/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { fetchHistory, type HistoryItem } from '@/features/check/api';
import { openCheck } from '@/features/check/navigation';
import { useResumeDraft } from '@/features/check/resume';
import { CHECK_STATUS_LABELS } from '@/features/check/status';

type Filter = 'all' | 'original' | 'replica' | 'inconclusive' | 'in_progress' | 'draft';
type Sort = 'recent' | 'score';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'original', label: 'Originais' },
  { key: 'replica', label: 'Réplicas' },
  { key: 'inconclusive', label: 'Inconclusivos' },
  { key: 'in_progress', label: 'Em análise' },
  { key: 'draft', label: 'Rascunhos' },
];

export default function ChecksHistory() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const resume = useResumeDraft();

  const { data: items, isPending } = useQuery({
    queryKey: ['checks-history'],
    queryFn: fetchHistory,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items ?? [];
    if (q) {
      list = list.filter((item) =>
        [item.brandName, item.modelName, item.categoryName]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q)),
      );
    }
    list = list.filter((item) => {
      switch (filter) {
        case 'all':
          return true;
        case 'draft':
          return item.status === 'awaiting_photos';
        case 'in_progress':
          return ['queued', 'processing', 'in_review'].includes(item.status);
        default:
          return item.outcome === filter;
      }
    });
    if (sort === 'score') {
      list = [...list].sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1));
    }
    return list;
  }, [items, query, filter, sort]);

  return (
    <Screen>
      <Text variant="titleLg">Seus checks</Text>

      <Field
        label="Buscar"
        value={query}
        onChangeText={setQuery}
        placeholder="Marca, modelo ou categoria…"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'center' }}>
        <Text variant="caption" color="tertiary">
          Ordenar:
        </Text>
        <Chip label="Recentes" selected={sort === 'recent'} onPress={() => setSort('recent')} />
        <Chip label="Maior score" selected={sort === 'score'} onPress={() => setSort('score')} />
      </View>

      {isPending ? (
        <ActivityIndicator color={theme.colors.brand.primary} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query || filter !== 'all' ? 'Nada por aqui' : 'Nenhum check ainda'}
          description={
            query || filter !== 'all'
              ? 'Ajuste a busca ou os filtros.'
              : 'Verifique sua primeira peça para começar seu histórico.'
          }
          action={
            query || filter !== 'all'
              ? undefined
              : { title: 'Fazer legit check', onPress: () => router.push('/check/new') }
          }
        />
      ) : (
        <View style={{ gap: theme.space.md }}>
          {filtered.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              onPress={() => {
                if (item.status === 'awaiting_photos') resume.mutate(item.id);
                else openCheck(item);
              }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function HistoryRow({ item, onPress }: { item: HistoryItem; onPress: () => void }) {
  const theme = useTheme();
  const outcome = item.outcome as VerdictOutcome | null;

  const accent =
    outcome === 'original'
      ? theme.colors.risk.low
      : outcome === 'replica'
        ? theme.colors.risk.high
        : outcome === 'inconclusive'
          ? theme.colors.risk.inconclusive
          : theme.colors.text.tertiary;

  const name =
    [item.brandName, item.modelName].filter(Boolean).join(' ') ||
    item.categoryName ||
    'Peça sem identificação';

  return (
    <PressableCard
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${accent}1A`,
        }}
      >
        <Ionicons
          name={
            outcome === 'original'
              ? 'shield-checkmark'
              : outcome === 'replica'
                ? 'shield-half'
                : item.status === 'awaiting_photos'
                  ? 'create-outline'
                  : 'hourglass-outline'
          }
          size={18}
          color={accent}
        />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="secondary">
          {item.categoryName ?? ''} ·{' '}
          {new Date(item.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
          })}{' '}
          · {CHECK_STATUS_LABELS[item.status as CheckStatus] ?? item.status}
        </Text>
      </View>

      {item.probability != null && outcome ? (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text variant="title" style={{ color: accent }}>
            {Math.round(Number(item.probability) * 100)}%
          </Text>
          <Text variant="caption" color="tertiary">
            {VERDICT_OUTCOME_LABELS[outcome]}
          </Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
      )}
    </PressableCard>
  );
}
