import type { PhotoChecklistStep, PhotoQuality } from '@garimpo/contracts';
import { create } from 'zustand';

export interface WizardCategory {
  id: string;
  slug: string;
  name: string;
}

export interface WizardBrand {
  id: string;
  name: string;
}

export interface WizardProduct {
  id: string | null;
  name: string;
}

export type UploadState = 'uploading' | 'uploaded' | 'error';

export interface WizardPhoto {
  region: string;
  localUri: string;
  quality: PhotoQuality | null;
  upload: UploadState;
}

interface WizardState {
  checkId: string | null;
  category: WizardCategory | null;
  brand: WizardBrand | null;
  product: WizardProduct | null;
  checklist: PhotoChecklistStep[];
  photos: Record<string, WizardPhoto>;

  setCategory: (category: WizardCategory) => void;
  setBrand: (brand: WizardBrand) => void;
  setProduct: (product: WizardProduct | null) => void;
  setChecklist: (checklist: PhotoChecklistStep[]) => void;
  setCheckId: (checkId: string) => void;
  upsertPhoto: (photo: WizardPhoto) => void;
  setPhotoUpload: (region: string, upload: UploadState) => void;
  hydrate: (state: {
    checkId: string;
    category: WizardCategory | null;
    brand: WizardBrand | null;
    product: WizardProduct | null;
    checklist: PhotoChecklistStep[];
    photos: Record<string, WizardPhoto>;
  }) => void;
  reset: () => void;
}

const initial = {
  checkId: null,
  category: null,
  brand: null,
  product: null,
  checklist: [],
  photos: {},
} satisfies Partial<WizardState>;

/** Estado do wizard de novo check — vive só durante o fluxo. */
export const useCheckWizard = create<WizardState>((set) => ({
  ...initial,

  // Trocar categoria/marca invalida o que vem depois no funil.
  setCategory: (category) =>
    set({ category, brand: null, product: null, checklist: [], photos: {}, checkId: null }),
  setBrand: (brand) => set({ brand, product: null }),
  setProduct: (product) => set({ product }),
  setChecklist: (checklist) => set({ checklist }),
  setCheckId: (checkId) => set({ checkId }),
  upsertPhoto: (photo) => set((s) => ({ photos: { ...s.photos, [photo.region]: photo } })),
  setPhotoUpload: (region, upload) =>
    set((s) => {
      const existing = s.photos[region];
      if (!existing) return s;
      return { photos: { ...s.photos, [region]: { ...existing, upload } } };
    }),
  hydrate: (state) => set({ ...state }),
  reset: () => set({ ...initial }),
}));

export function requiredProgress(
  checklist: PhotoChecklistStep[],
  photos: Record<string, WizardPhoto>,
): { done: number; total: number; complete: boolean } {
  const required = checklist.filter((s) => s.required);
  const done = required.filter((s) => photos[s.region]?.upload === 'uploaded').length;
  return { done, total: required.length, complete: done === required.length };
}
