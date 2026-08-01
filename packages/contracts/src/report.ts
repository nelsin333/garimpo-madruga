import { z } from 'zod';
import { riskLevelSchema } from './check';

/** Resultado exibido ao usuário — derivado de probabilidade + risco. */
export const verdictOutcomeSchema = z.enum(['original', 'replica', 'inconclusive']);
export type VerdictOutcome = z.infer<typeof verdictOutcomeSchema>;

export const VERDICT_OUTCOME_LABELS: Record<VerdictOutcome, string> = {
  original: 'Original',
  replica: 'Réplica',
  inconclusive: 'Inconclusivo',
};

export const confidenceSchema = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof confidenceSchema>;

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  low: 'Confiança baixa',
  medium: 'Confiança média',
  high: 'Confiança alta',
};

/** Bounding box normalizada (0–1) sobre a foto analisada. */
export const bboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type BBox = z.infer<typeof bboxSchema>;

export const findingPolaritySchema = z.enum(['positive', 'suspicious', 'neutral']);
export type FindingPolarity = z.infer<typeof findingPolaritySchema>;

/** Uma evidência do laudo — sempre ancorada em foto + região. */
export const findingSchema = z.object({
  region: z.string(),
  kind: z.string(),
  polarity: findingPolaritySchema,
  score: z.number().min(0).max(1).nullable(),
  title: z.string(),
  detail_md: z.string(),
  conclusion_md: z.string(),
  bbox: bboxSchema.nullable(),
});
export type Finding = z.infer<typeof findingSchema>;

/**
 * Regras de produto para o veredito (mantidas junto do contrato para que
 * app, processador e pipeline apliquem exatamente o mesmo mapeamento):
 * "original"/"réplica" só com confiança suficiente; o resto é inconclusivo.
 */
export function outcomeFromVerdict(
  probability: number,
  risk: z.infer<typeof riskLevelSchema>,
): VerdictOutcome {
  if (risk === 'inconclusive') return 'inconclusive';
  if (probability >= 0.85 && risk === 'low') return 'original';
  if (probability <= 0.35) return 'replica';
  return 'inconclusive';
}
