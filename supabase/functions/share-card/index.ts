// Card social (SVG 1200x630) de um certificado público — usado em links
// compartilhados. GET ?code=GM-XXXX-XXXX. Público (dados vêm da função
// public_certificate, que já limita o que pode ser exposto).
import { corsHeaders, serviceClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const code = new URL(req.url).searchParams.get('code');
  if (!code || !/^GM-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code)) {
    return new Response('invalid code', { status: 400, headers: corsHeaders });
  }

  const service = serviceClient();
  const { data, error } = await service.rpc('public_certificate', { p_code: code });
  if (error || !data) {
    return new Response('certificate not found', { status: 404, headers: corsHeaders });
  }

  const cert = data as {
    code: string;
    revoked: boolean;
    authenticity_probability: number;
    outcome: string;
    piece: { brand: string | null; category: string | null; model: string | null };
  };
  if (cert.revoked) {
    return new Response('certificate revoked', { status: 410, headers: corsHeaders });
  }

  const percent = Math.round(Number(cert.authenticity_probability) * 100);
  const pieceName = escapeXml(
    [cert.piece.brand, cert.piece.model ?? cert.piece.category].filter(Boolean).join(' ') ||
      'Peça verificada',
  );
  const outcomeLabel =
    cert.outcome === 'original'
      ? 'Original'
      : cert.outcome === 'replica'
        ? 'Réplica'
        : 'Inconclusivo';
  const accent =
    cert.outcome === 'original' ? '#34C77B' : cert.outcome === 'replica' ? '#F0564A' : '#8E8E99';

  // Anel de score: circunferência r=90 → 565.5
  const circumference = 2 * Math.PI * 90;
  const dash = (percent / 100) * circumference;

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0A0A0B"/>
  <rect x="40" y="40" width="1120" height="550" rx="28" fill="#131316" stroke="#26262C"/>
  <text x="100" y="140" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#C8F04A">garimpo madruga</text>
  <text x="100" y="200" font-family="Arial, sans-serif" font-size="26" fill="#A0A0AB">Legit Check · Certificado ${escapeXml(cert.code)}</text>
  <text x="100" y="300" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#F5F5F6">${pieceName}</text>
  <text x="100" y="380" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="${accent}">${outcomeLabel}</text>
  <text x="100" y="440" font-family="Arial, sans-serif" font-size="26" fill="#A0A0AB">Análise probabilística baseada em evidências</text>
  <text x="100" y="530" font-family="Arial, sans-serif" font-size="22" fill="#63636E">garimpomadruga.com.br · se tem selo, é real</text>
  <g transform="translate(950, 315)">
    <circle r="90" fill="none" stroke="#26262C" stroke-width="18"/>
    <circle r="90" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}"
      transform="rotate(-90)"/>
    <text y="18" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="800" fill="${accent}">${percent}%</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      ...corsHeaders,
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=3600',
    },
  });
});

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
