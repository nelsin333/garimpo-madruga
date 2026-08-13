'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PublicFinding {
  title: string;
  region: string;
  polarity: string;
  conclusion: string;
}

interface Certificate {
  code: string;
  revoked: boolean;
  issued_at: string;
  authenticity_probability: number;
  risk: string;
  outcome: string;
  confidence: string;
  summary_md: string;
  piece: { brand: string | null; category: string | null; model: string | null };
  checked_at: string | null;
  public_findings: PublicFinding[];
  listing_id: string | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  original: 'Original',
  replica: 'Réplica',
  inconclusive: 'Inconclusivo',
};

/** Página pública do certificado — destino do QR Code. Sem login. */
export default function CertificatePage() {
  const { code } = useParams<{ code: string }>();
  const [cert, setCert] = useState<Certificate | null | 'missing'>(null);

  useEffect(() => {
    supabase()
      .rpc('public_certificate', { p_code: code })
      .then(({ data }) => setCert((data as unknown as Certificate | null) ?? 'missing'));
  }, [code]);

  if (cert === null) return <p className="muted">Carregando certificado…</p>;
  if (cert === 'missing') {
    return (
      <div className="card">
        <h1>Certificado não encontrado</h1>
        <p className="muted">Confira o código impresso no anúncio ou na etiqueta.</p>
      </div>
    );
  }

  const percent = Math.round(Number(cert.authenticity_probability) * 100);
  const accentClass = cert.outcome === 'original' ? 'authentic' : 'replica';
  const piece =
    [cert.piece.brand, cert.piece.model ?? cert.piece.category].filter(Boolean).join(' ') ||
    'Peça verificada';

  return (
    <>
      <p className="muted">Certificado público · Garimpo Madruga</p>
      <h1>{piece}</h1>

      {cert.revoked ? (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <strong style={{ color: 'var(--red)' }}>Certificado revogado</strong>
          <p className="muted">Este laudo não é mais válido.</p>
        </div>
      ) : null}

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="value" style={{ color: 'var(--green)' }}>
            {percent}%
          </div>
          <div className="label">Probabilidade de autenticidade</div>
        </div>
        <div className="stat">
          <div className="value">
            <span className={`pill ${accentClass}`}>
              {OUTCOME_LABELS[cert.outcome] ?? cert.outcome}
            </span>
          </div>
          <div className="label">Resultado · confiança {cert.confidence}</div>
        </div>
        <div className="stat">
          <div className="value" style={{ fontSize: 18 }}>
            {cert.code}
          </div>
          <div className="label">
            Emitido em {new Date(cert.issued_at).toLocaleDateString('pt-BR')}
            {cert.checked_at
              ? ` · analisado em ${new Date(cert.checked_at).toLocaleDateString('pt-BR')}`
              : ''}
          </div>
        </div>
      </div>

      <h2>Resumo do laudo</h2>
      <div className="card">
        <p style={{ margin: 0 }}>{cert.summary_md}</p>
      </div>

      <h2>Evidências ({cert.public_findings.length})</h2>
      <div className="card">
        {cert.public_findings.length === 0 ? (
          <p className="muted">Sem evidências públicas registradas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Avaliação</th>
                <th>Conclusão</th>
              </tr>
            </thead>
            <tbody>
              {cert.public_findings.map((finding, index) => (
                <tr key={`${finding.title}-${index}`}>
                  <td>{finding.title}</td>
                  <td>
                    <span
                      className={`pill ${finding.polarity === 'positive' ? 'authentic' : 'muted'}`}
                    >
                      {finding.polarity === 'positive' ? 'confere' : 'atenção'}
                    </span>
                  </td>
                  <td>{finding.conclusion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {cert.listing_id ? (
        <p style={{ marginTop: 16 }}>
          <a href={`/l/${cert.listing_id}`}>Ver anúncio desta peça →</a>
        </p>
      ) : null}

      <p className="muted" style={{ marginTop: 24 }}>
        ⓘ Análise probabilística baseada nas fotos enviadas e em referências catalogadas. Não é
        garantia absoluta de autenticidade. Confira se a peça em mãos corresponde às fotos do
        anúncio.
      </p>
    </>
  );
}
