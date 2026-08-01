import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { fetchChecklist, fetchDraftForResume } from './api';
import { useCheckWizard } from './store';

/** Retoma um check em rascunho: hidrata o wizard e abre a tela de fotos. */
export function useResumeDraft() {
  return useMutation({
    mutationFn: async (checkId: string) => {
      const { row, wizardPhotos } = await fetchDraftForResume(checkId);
      if (!row.categories) throw new Error('draft_without_category');
      const checklist = await fetchChecklist(
        row.categories.id,
        row.categories.slug,
        row.brands?.id ?? null,
      );
      useCheckWizard.getState().hydrate({
        checkId: row.id,
        category: row.categories,
        brand: row.brands,
        product:
          row.products ??
          (row.declared?.model_name ? { id: null, name: row.declared.model_name } : null),
        checklist,
        photos: wizardPhotos,
      });
    },
    onSuccess: () => router.push('/check/new/photos'),
    onError: () => Alert.alert('Não foi possível retomar', 'Tente novamente.'),
  });
}
