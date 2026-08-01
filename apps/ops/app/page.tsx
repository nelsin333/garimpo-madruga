'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Stats {
  items_total: number;
  items_authentic: number;
  items_replica: number;
  items_quarantined: number;
  brands_covered: number;
  products_covered: number;
  photos_total: number;
  photos_processed: number;
  embeddings_total: number;
  annotations_total: number;
  storage_bytes: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase()
      .rpc('admin_reference_stats')
      .then(({ data, error: rpcError }) => {
        if (rpcError) setError(rpcError.message);
        else setStats(data as unknown as Stats);
      });
  }, []);

  if (error) return <p style={{ color: 'var(--red)' }}>Erro ao carregar métricas: {error}</p>;
  if (!stats) return <p className="muted">Carregando métricas…</p>;

  const gb = stats.storage_bytes / 1024 ** 3;

  return (
    <>
      <h1>Dashboard do acervo</h1>
      <p className="muted">O ativo mais importante do produto — alimente-o todo dia.</p>

      <h2>Peças</h2>
      <div className="grid cols-4">
        <Stat label="Peças cadastradas" value={stats.items_total} />
        <Stat label="Originais" value={stats.items_authentic} color="var(--green)" />
        <Stat label="Réplicas" value={stats.items_replica} color="var(--red)" />
        <Stat label="Em quarentena" value={stats.items_quarantined} color="var(--amber)" />
      </div>

      <h2>Cobertura</h2>
      <div className="grid cols-2">
        <Stat label="Marcas com referência" value={stats.brands_covered} />
        <Stat label="Modelos com referência" value={stats.products_covered} />
      </div>

      <h2>Processamento</h2>
      <div className="grid cols-4">
        <Stat label="Fotos enviadas" value={stats.photos_total} />
        <Stat label="Fotos processadas" value={stats.photos_processed} />
        <Stat label="Embeddings gerados" value={stats.embeddings_total} />
        <Stat
          label="Espaço utilizado"
          value={
            gb >= 1 ? `${gb.toFixed(2)} GB` : `${(stats.storage_bytes / 1024 ** 2).toFixed(1)} MB`
          }
        />
      </div>

      <h2>Curadoria</h2>
      <div className="grid cols-2">
        <Stat label="Anotações de especialistas" value={stats.annotations_total} />
        <div className="stat">
          <div className="label">Regra de ouro</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>
            Peça sai da quarentena só depois de revisão no modo especialista — referência
            contaminada envenena o kNN.
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="stat">
      <div className="value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="label">{label}</div>
    </div>
  );
}
