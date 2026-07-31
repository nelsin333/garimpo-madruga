import type { CheckStatus } from '@garimpo/contracts';

export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  awaiting_photos: 'Aguardando fotos',
  queued: 'Na fila',
  processing: 'Em análise',
  in_review: 'Com especialistas',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};
