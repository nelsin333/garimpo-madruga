import { z } from 'zod';

/** Estados do legit check — espelha o enum `check_status` do Postgres. */
export const checkStatusSchema = z.enum([
  'awaiting_photos',
  'queued',
  'processing',
  'in_review',
  'completed',
  'cancelled',
  'refunded',
  'failed',
]);
export type CheckStatus = z.infer<typeof checkStatusSchema>;

/** Espelha o enum `risk_level` do Postgres. */
export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'inconclusive']);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

/**
 * Regiões fotografáveis de uma peça. O checklist de cada categoria
 * (categories.photo_checklist, com override por marca em brands.photo_checklist)
 * referencia estes ids — validar aqui garante que app, banco e pipeline
 * falam o mesmo vocabulário.
 */
export const photoRegionSchema = z.enum([
  'front',
  'back',
  'neck_tag',
  'wash_tag',
  'logo',
  'embroidery',
  'print',
  'stitching',
  'collar_stitch',
  'hem_stitch',
  'pocket_stitch',
  'cuffs',
  'buttons',
  'zipper',
  'hardware',
  'lining',
  'interior_label',
  'serial',
  'size_tag',
  'hang_tag',
  'qr_code',
  'insole',
  'outsole',
  'heel_tab',
  'box_label',
  'packaging',
  'receipt',
  'defects',
]);
export type PhotoRegion = z.infer<typeof photoRegionSchema>;

/** Um passo do checklist de fotos exibido na câmera guiada. */
export const photoChecklistStepSchema = z.object({
  region: photoRegionSchema,
  label: z.string().min(1),
  hint: z.string().min(1),
  required: z.boolean().default(true),
});
export type PhotoChecklistStep = z.infer<typeof photoChecklistStepSchema>;

export const photoChecklistSchema = z.array(photoChecklistStepSchema).min(1);
export type PhotoChecklist = z.infer<typeof photoChecklistSchema>;
