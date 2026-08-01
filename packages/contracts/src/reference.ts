import { z } from 'zod';
import { photoRegionSchema } from './check';

export const authenticitySchema = z.enum(['authentic', 'replica']);
export type Authenticity = z.infer<typeof authenticitySchema>;

export const AUTHENTICITY_LABELS: Record<Authenticity, string> = {
  authentic: 'Original',
  replica: 'Réplica',
};

export const genderSchema = z.enum(['masculino', 'feminino', 'unissex', 'infantil']);

/** Cadastro/edição de peça de referência (painel ops e modo especialista). */
export const referenceItemInputSchema = z.object({
  brand_id: z.string().uuid(),
  category_id: z.string().uuid(),
  product_id: z.string().uuid().nullable().optional(),
  authenticity: authenticitySchema,
  sku: z.string().max(60).nullable().optional(),
  colorway: z.string().max(80).nullable().optional(),
  collection: z.string().max(80).nullable().optional(),
  release_year: z.number().int().min(1950).max(2100).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
  size_label: z.string().max(20).nullable().optional(),
  material: z.string().max(120).nullable().optional(),
  gender: genderSchema.nullable().optional(),
  era: z.string().max(40).nullable().optional(),
  serial_format: z.string().max(200).nullable().optional(),
  notes_md: z.string().max(4000).nullable().optional(),
  replica_batch: z.string().max(80).nullable().optional(),
  provenance_confidence: z.number().int().min(1).max(5).default(3),
  quality_score: z.number().int().min(1).max(5).default(3),
});
export type ReferenceItemInput = z.infer<typeof referenceItemInputSchema>;

/** Regiões de captura do acervo (superset dos checklists de check). */
export const REFERENCE_REGIONS: { region: string; label: string }[] = [
  { region: 'front', label: 'Frente' },
  { region: 'back', label: 'Costas' },
  { region: 'logo', label: 'Logo' },
  { region: 'neck_tag', label: 'Neck tag' },
  { region: 'wash_tag', label: 'Wash tag' },
  { region: 'size_tag', label: 'Size tag' },
  { region: 'collar_stitch', label: 'Costura da gola' },
  { region: 'stitching', label: 'Costura lateral' },
  { region: 'hem_stitch', label: 'Barra' },
  { region: 'cuffs', label: 'Manga / punho' },
  { region: 'embroidery', label: 'Bordado' },
  { region: 'print', label: 'Estampa' },
  { region: 'interior_label', label: 'Etiquetas internas' },
  { region: 'qr_code', label: 'QR Code' },
  { region: 'serial', label: 'Serial' },
  { region: 'buttons', label: 'Botões' },
  { region: 'zipper', label: 'Zíper' },
  { region: 'defects', label: 'Outros detalhes' },
];

for (const entry of REFERENCE_REGIONS) {
  photoRegionSchema.parse(entry.region); // garante vocabulário único
}

/** Aspectos anotáveis pelo especialista. */
export const annotationAspectSchema = z.enum([
  'stitching',
  'label',
  'logo',
  'typography',
  'qr',
  'embroidery',
  'wash_tag',
  'material',
  'hardware',
  'print',
  'other',
]);
export type AnnotationAspect = z.infer<typeof annotationAspectSchema>;

export const ANNOTATION_ASPECT_LABELS: Record<AnnotationAspect, string> = {
  stitching: 'Costura',
  label: 'Etiqueta',
  logo: 'Logo',
  typography: 'Tipografia',
  qr: 'QR Code',
  embroidery: 'Bordado',
  wash_tag: 'Etiqueta de lavagem',
  material: 'Material',
  hardware: 'Aviamentos',
  print: 'Estampa',
  other: 'Outro',
};

export const annotationAssessmentSchema = z.enum(['correct', 'incorrect', 'uncertain']);
export type AnnotationAssessment = z.infer<typeof annotationAssessmentSchema>;

export const ANNOTATION_ASSESSMENT_LABELS: Record<AnnotationAssessment, string> = {
  correct: 'Correto',
  incorrect: 'Incorreto',
  uncertain: 'Incerto',
};

export const annotationInputSchema = z.object({
  reference_item_id: z.string().uuid(),
  photo_id: z.string().uuid().nullable().optional(),
  aspect: annotationAspectSchema,
  assessment: annotationAssessmentSchema,
  note: z.string().max(2000).default(''),
});
export type AnnotationInput = z.infer<typeof annotationInputSchema>;
