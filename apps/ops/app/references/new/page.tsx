'use client';

import { referenceItemInputSchema } from '@garimpo/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShell } from '@/components/Shell';
import { supabase } from '@/lib/supabase';

interface Option {
  id: string;
  name: string;
}

export default function NewReferencePage() {
  const router = useRouter();
  const { session } = useShell();
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    brand_id: '',
    category_id: '',
    product_id: '',
    authenticity: 'authentic',
    sku: '',
    colorway: '',
    collection: '',
    release_year: '',
    country: '',
    size_label: '',
    material: '',
    gender: '',
    replica_batch: '',
    provenance_confidence: '3',
    notes_md: '',
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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

  useEffect(() => {
    if (!form.brand_id) {
      setProducts([]);
      return;
    }
    supabase()
      .from('products')
      .select('id, name')
      .eq('brand_id', form.brand_id)
      .order('name')
      .limit(200)
      .then(({ data }) => setProducts(data ?? []));
  }, [form.brand_id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = referenceItemInputSchema.safeParse({
      brand_id: form.brand_id,
      category_id: form.category_id,
      product_id: form.product_id || null,
      authenticity: form.authenticity,
      sku: form.sku || null,
      colorway: form.colorway || null,
      collection: form.collection || null,
      release_year: form.release_year ? Number(form.release_year) : null,
      country: form.country || null,
      size_label: form.size_label || null,
      material: form.material || null,
      gender: form.gender || null,
      replica_batch: form.authenticity === 'replica' ? form.replica_batch || null : null,
      provenance_confidence: Number(form.provenance_confidence),
      notes_md: form.notes_md || null,
    });
    if (!parsed.success) {
      setError('Preencha marca, categoria e tipo — e confira os demais campos.');
      return;
    }

    setPending(true);
    const { data, error: insertError } = await supabase()
      .from('reference_items')
      .insert({ ...parsed.data, created_by: session.user.id })
      .select('id')
      .single();
    setPending(false);

    if (insertError || !data) {
      setError(insertError?.message ?? 'Falha ao salvar');
      return;
    }
    router.push(`/references/${data.id}`);
  }

  const isReplica = form.authenticity === 'replica';

  return (
    <>
      <h1>Nova peça de referência</h1>
      <p className="muted">Cadastre os metadados; as fotos vêm na próxima etapa.</p>

      <form className="card" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
        <div className="grid cols-3">
          <div>
            <label>Marca *</label>
            <select
              value={form.brand_id}
              onChange={(e) => set('brand_id', e.target.value)}
              required
            >
              <option value="">Selecione</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Categoria *</label>
            <select
              value={form.category_id}
              onChange={(e) => set('category_id', e.target.value)}
              required
            >
              <option value="">Selecione</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Modelo</label>
            <select value={form.product_id} onChange={(e) => set('product_id', e.target.value)}>
              <option value="">Sem modelo específico</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Tipo *</label>
            <select value={form.authenticity} onChange={(e) => set('authenticity', e.target.value)}>
              <option value="authentic">Original</option>
              <option value="replica">Réplica</option>
            </select>
          </div>
          {isReplica ? (
            <div>
              <label>Batch / fábrica (se conhecido)</label>
              <input
                value={form.replica_batch}
                onChange={(e) => set('replica_batch', e.target.value)}
                placeholder="PK God, LJR, batch 2023…"
              />
            </div>
          ) : null}
          <div>
            <label>Confiança da origem (1–5) *</label>
            <select
              value={form.provenance_confidence}
              onChange={(e) => set('provenance_confidence', e.target.value)}
            >
              <option value="5">5 — comprada lacrada em loja oficial</option>
              <option value="4">4 — procedência documentada</option>
              <option value="3">3 — procedência provável</option>
              <option value="2">2 — procedência incerta</option>
              <option value="1">1 — origem desconhecida</option>
            </select>
          </div>

          <div>
            <label>SKU</label>
            <input
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
              placeholder="DD1391-100"
            />
          </div>
          <div>
            <label>Cor / colorway</label>
            <input value={form.colorway} onChange={(e) => set('colorway', e.target.value)} />
          </div>
          <div>
            <label>Coleção</label>
            <input
              value={form.collection}
              onChange={(e) => set('collection', e.target.value)}
              placeholder="FW23"
            />
          </div>
          <div>
            <label>Ano</label>
            <input
              value={form.release_year}
              onChange={(e) => set('release_year', e.target.value.replace(/\D/g, ''))}
              placeholder="2021"
            />
          </div>
          <div>
            <label>País de fabricação</label>
            <input
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="Vietnã"
            />
          </div>
          <div>
            <label>Tamanho</label>
            <input
              value={form.size_label}
              onChange={(e) => set('size_label', e.target.value)}
              placeholder="G / 42"
            />
          </div>
          <div>
            <label>Material</label>
            <input
              value={form.material}
              onChange={(e) => set('material', e.target.value)}
              placeholder="100% algodão"
            />
          </div>
          <div>
            <label>Gênero</label>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">—</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="unissex">Unissex</option>
              <option value="infantil">Infantil</option>
            </select>
          </div>
        </div>

        <label>Observações</label>
        <textarea
          rows={3}
          value={form.notes_md}
          onChange={(e) => set('notes_md', e.target.value)}
          placeholder="Pontos de verificação, história da peça, detalhes de aquisição…"
        />

        {error ? <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p> : null}

        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={pending}>
            {pending ? 'Salvando…' : 'Cadastrar e adicionar fotos'}
          </button>
        </div>
      </form>
    </>
  );
}
