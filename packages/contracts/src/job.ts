import { z } from 'zod';

/** Estado de um job de processamento — espelha o enum `job_status` do Postgres. */
export const jobStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export type JobStatus = z.infer<typeof jobStatusSchema>;

/**
 * Etapas do pipeline de análise, na ordem de execução.
 * O Sprint 3 substitui o processador simulado pelo pipeline real,
 * mantendo exatamente estes estágios e este contrato.
 */
export const jobStageSchema = z.enum([
  'preparing',
  'extracting_regions',
  'analyzing_details',
  'comparing_references',
  'scoring',
  'generating_report',
  'finalizing',
]);
export type JobStage = z.infer<typeof jobStageSchema>;

export const JOB_STAGES: readonly JobStage[] = jobStageSchema.options;

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  preparing: 'Preparando imagens…',
  extracting_regions: 'Extraindo regiões…',
  analyzing_details: 'Analisando detalhes…',
  comparing_references: 'Comparando referências…',
  scoring: 'Calculando score…',
  generating_report: 'Gerando laudo…',
  finalizing: 'Finalizando…',
};
