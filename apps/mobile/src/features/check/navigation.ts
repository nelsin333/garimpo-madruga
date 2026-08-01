import { router } from 'expo-router';

/** Para onde cada status de check leva ao ser tocado. */
export function openCheck(check: { id: string; status: string }): void {
  switch (check.status) {
    case 'completed':
      router.push({ pathname: '/check/[id]/report', params: { id: check.id } });
      break;
    case 'queued':
    case 'processing':
    case 'in_review':
    case 'failed':
    case 'cancelled':
      router.push({ pathname: '/check/[id]/processing', params: { id: check.id } });
      break;
    default:
      // awaiting_photos: retomada é feita pelo chamador (precisa hidratar o wizard)
      break;
  }
}
