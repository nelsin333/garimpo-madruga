import { Share } from 'react-native';
import { formatPriceBRL } from '@garimpo/contracts';

/** Base pública do site (páginas de anúncio e certificado). */
export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://garimpomadruga.com.br';

export function listingUrl(listingId: string): string {
  return `${WEB_BASE_URL}/l/${listingId}`;
}

export function certificateUrl(code: string): string {
  return `${WEB_BASE_URL}/cert/${code}`;
}

/** Card social (SVG) servido pela Edge Function share-card. */
export function shareCardUrl(code: string): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/functions/v1/share-card?code=${encodeURIComponent(code)}`;
}

export async function shareListing(input: {
  listingId: string;
  title: string;
  priceCents: number | null;
  certificateCode: string | null;
}): Promise<void> {
  const lines = [
    input.title,
    input.priceCents != null ? formatPriceBRL(input.priceCents) : null,
    input.certificateCode ? `🛡️ Peça autenticada — certificado ${input.certificateCode}` : null,
    listingUrl(input.listingId),
  ].filter((line): line is string => line !== null);

  await Share.share({ message: lines.join('\n') });
}
