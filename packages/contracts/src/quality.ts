import { z } from 'zod';

/** Problemas detectáveis pela análise básica de qualidade no dispositivo. */
export const photoIssueSchema = z.enum(['blurry', 'dark', 'glare', 'too_close', 'too_far']);
export type PhotoIssue = z.infer<typeof photoIssueSchema>;

export const PHOTO_ISSUE_LABELS: Record<PhotoIssue, string> = {
  blurry: 'Foto tremida — segure firme e tente de novo',
  dark: 'Pouca luz — procure um lugar mais iluminado',
  glare: 'Reflexo forte — mude o ângulo ou afaste do flash',
  too_close: 'Muito perto — afaste um pouco a câmera',
  too_far: 'Muito longe — aproxime para preencher a moldura',
};

/** Métricas salvas em check_photos.quality (auditáveis pelo pipeline no Sprint 3). */
export const photoQualitySchema = z.object({
  ok: z.boolean(),
  issues: z.array(photoIssueSchema),
  metrics: z.object({
    sharpness: z.number(),
    brightness: z.number(),
    overexposed_ratio: z.number(),
    detail_coverage: z.number(),
  }),
});
export type PhotoQuality = z.infer<typeof photoQualitySchema>;
