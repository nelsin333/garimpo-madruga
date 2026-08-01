'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Row {
  id: string;
  authenticity: 'authentic' | 'replica';
  sku: string | null;
  collection: string | null;
  release_year: number | null;
  replica_batch: string | null;
  quarantined: boolean;
  created_at: string;
  brands: { name: string } | null;
  categories: { name: string } | null;
  products: { name: string } | null;
}

interface Option {
  id: string;
  name: string;
}

export default function ReferencesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [authenticity, setAuthenticity] = useState('');
  const [year, setYear] = useState('');
  const [batch, setBatch] = useState('');

  useEffect(() => {
    const client = supabase();
    client
      .from('brands')
      .select('id, name')
      .order('name')
      .then(({ data }) => setBrands(data ?? []));
    client
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    let builder = supabase()
      .from('reference_items')
      .select(
        'id, authenticity, sku, collection, release_year, replica_batch, quarantined, created_at, brands(name), categories(name), products(name)',
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (brandId) builder = builder.eq('brand_id', brandId);
    if (categoryId) builder = builder.eq('category_id', categoryId);
    if (authenticity) builder = builder.eq('authenticity', authenticity as 'authentic' | 'replica');
    if (year) builder = builder.eq('release_year', Number(year));
    if (batch) builder = builder.ilike('replica_batch', `%${batch}%`);
    if (query) {
      builder = builder.or(`sku.ilike.%${query}%,collection.ilike.%${query}%`);
    }

    const { data } = await builder;
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, [brandId, categoryId, authenticity, year, batch, query]);

  useEffect(() => {
    void search();
  }, [search]);

  return (
    <>
      <h1>Referências</h1>
      <p className="muted">
        Busca por marca, modelo, SKU, ano, coleção, categoria, tipo e batch. Busca livre cobre SKU
        e coleção — para modelo, use os filtros.
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="grid cols-3">
          <div>
            <label>Busca (SKU / coleção)</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="DD1391, FW23…" />
          </div>
          <div>
            <label>Marca</label>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">Todas</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Categoria</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Tipo</label>
            <select value={authenticity} onChange={(e) => setAuthenticity(e.target.value)}>
              <option value="">Todos</option>
              <option value="authentic">Original</option>
              <option value="replica">Réplica</option>
            </select>
          </div>
          <div>
            <label>Ano</label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
              placeholder="2021"
            />
          </div>
          <div>
            <label>Batch (réplicas)</label>
            <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="PK God…" />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <p className="muted">Buscando…</p>
        ) : rows.length === 0 ? (
          <p className="muted">
            Nenhuma peça encontrada. <Link href="/references/new">Cadastrar a primeira</Link>.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Peça</th>
                <th>Tipo</th>
                <th>SKU</th>
                <th>Coleção</th>
                <th>Ano</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/references/${row.id}`}>
                      {[row.brands?.name, row.products?.name ?? row.categories?.name]
                        .filter(Boolean)
                        .join(' ')}
                    </Link>
                  </td>
                  <td>
                    <span className={`pill ${row.authenticity}`}>
                      {row.authenticity === 'authentic' ? 'Original' : 'Réplica'}
                    </span>
                    {row.replica_batch ? (
                      <span className="muted"> {row.replica_batch}</span>
                    ) : null}
                  </td>
                  <td>{row.sku ?? '—'}</td>
                  <td>{row.collection ?? '—'}</td>
                  <td>{row.release_year ?? '—'}</td>
                  <td>
                    <span className={`pill ${row.quarantined ? 'muted' : 'authentic'}`}>
                      {row.quarantined ? 'quarentena' : 'ativa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
