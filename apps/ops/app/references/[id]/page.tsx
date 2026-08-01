'use client';

import {
  ANNOTATION_ASPECT_LABELS,
  ANNOTATION_ASSESSMENT_LABELS,
  REFERENCE_REGIONS,
  annotationAspectSchema,
  annotationAssessmentSchema,
} from '@garimpo/contracts';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useShell } from '@/components/Shell';
import { REFERENCE_BUCKET, supabase } from '@/lib/supabase';

interface Item {
  id: string;
  authenticity: 'authentic' | 'replica';
  sku: string | null;
  colorway: string | null;
  collection: string | null;
  release_year: number | null;
  country: string | null;
  size_label: string | null;
  material: string | null;
  gender: string | null;
  replica_batch: string | null;
  provenance_confidence: number;
  quarantined: boolean;
  notes_md: string | null;
  brands: { name: string } | null;
  categories: { name: string } | null;
  products: { name: string } | null;
}

interface Photo {
  id: string;
  region: string;
  storage_path: string;
  url?: string;
}

interface Annotation {
  id: string;
  aspect: string;
  assessment: string;
  note: string;
  created_at: string;
  created_by: string;
  photo_id: string | null;
}

interface Version {
  id: string;
  version: number;
  changed_at: string;
}

interface Job {
  id: string;
  status: string;
  stage: string | null;
  progress: number;
  error: string | null;
}

interface Similar {
  photo_id: string;
  reference_item_id: string;
  region: string;
  similarity: number;
  authenticity: 'authentic' | 'replica';
  brand_name: string | null;
  product_name: string | null;
}

export default function ReferenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useShell();

  const [item, setItem] = useState<Item | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [similar, setSimilar] = useState<{ photo: Photo; rows: Similar[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = supabase();
    const [itemRes, photosRes, annotationsRes, versionsRes, jobsRes] = await Promise.all([
      client
        .from('reference_items')
        .select('*, brands(name), categories(name), products(name)')
        .eq('id', id)
        .single(),
      client
        .from('reference_photos')
        .select('id, region, storage_path')
        .eq('reference_item_id', id)
        .order('created_at'),
      client
        .from('reference_annotations')
        .select('*')
        .eq('reference_item_id', id)
        .order('created_at', { ascending: false }),
      client
        .from('reference_item_versions')
        .select('id, version, changed_at')
        .eq('reference_item_id', id)
        .order('version', { ascending: false }),
      client
        .from('reference_jobs')
        .select('id, status, stage, progress, error')
        .eq('reference_item_id', id)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    setItem(itemRes.data as unknown as Item);
    setAnnotations((annotationsRes.data as Annotation[]) ?? []);
    setVersions((versionsRes.data as Version[]) ?? []);
    setJob((jobsRes.data?.[0] as Job) ?? null);

    const photoRows = (photosRes.data as Photo[]) ?? [];
    if (photoRows.length > 0) {
      const { data: signed } = await client.storage
        .from(REFERENCE_BUCKET)
        .createSignedUrls(
          photoRows.map((p) => p.storage_path),
          3600,
        );
      signed?.forEach((entry, index) => {
        if (entry.signedUrl) photoRows[index]!.url = entry.signedUrl;
      });
    }
    setPhotos(photoRows);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Acompanha o job em andamento.
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;
    const timer = setInterval(async () => {
      const { data } = await supabase()
        .from('reference_jobs')
        .select('id, status, stage, progress, error')
        .eq('id', job.id)
        .single();
      if (data) setJob(data as Job);
      if (data?.status === 'completed') void load();
    }, 2000);
    return () => clearInterval(timer);
  }, [job, load]);

  async function upload(region: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(region);
    const client = supabase();
    for (const file of Array.from(files)) {
      const path = `${id}/${region}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await client.storage
        .from(REFERENCE_BUCKET)
        .upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (uploadError) continue;
      await client.from('reference_photos').insert({
        reference_item_id: id,
        region,
        storage_path: path,
        meta: { bytes: file.size, original_name: file.name },
      });
    }
    setBusy(null);
    void load();
  }

  async function process() {
    setBusy('process');
    await supabase().from('reference_jobs').insert({ reference_item_id: id });
    setBusy(null);
    void load();
  }

  async function toggleQuarantine() {
    if (!item) return;
    await supabase()
      .from('reference_items')
      .update({ quarantined: !item.quarantined })
      .eq('id', id);
    void load();
  }

  async function addAnnotation(formData: FormData) {
    const aspect = annotationAspectSchema.parse(formData.get('aspect'));
    const assessment = annotationAssessmentSchema.parse(formData.get('assessment'));
    const note = String(formData.get('note') ?? '');
    const photoId = String(formData.get('photo_id') ?? '');
    await supabase()
      .from('reference_annotations')
      .insert({
        reference_item_id: id,
        photo_id: photoId || null,
        aspect,
        assessment,
        note,
        created_by: session.user.id,
      });
    void load();
  }

  async function removeAnnotation(annotationId: string) {
    await supabase().from('reference_annotations').delete().eq('id', annotationId);
    void load();
  }

  async function showSimilar(photo: Photo) {
    const { data } = await supabase().rpc('admin_similar_reference_photos', {
      p_photo_id: photo.id,
      p_limit: 8,
    });
    setSimilar({ photo, rows: (data as Similar[]) ?? [] });
  }

  if (!item) return <p className="muted">Carregando…</p>;

  const title = [item.brands?.name, item.products?.name ?? item.categories?.name]
    .filter(Boolean)
    .join(' ');
  const byRegion = new Map<string, Photo[]>();
  for (const photo of photos) {
    byRegion.set(photo.region, [...(byRegion.get(photo.region) ?? []), photo]);
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>{title}</h1>
          <div className="row">
            <span className={`pill ${item.authenticity}`}>
              {item.authenticity === 'authentic' ? 'Original' : 'Réplica'}
            </span>
            {item.replica_batch ? <span className="pill muted">{item.replica_batch}</span> : null}
            <span className={`pill ${item.quarantined ? 'muted' : 'authentic'}`}>
              {item.quarantined ? 'quarentena' : 'ativa no kNN'}
            </span>
            <span className="muted">confiança de origem {item.provenance_confidence}/5</span>
          </div>
        </div>
        <div className="row">
          <button className="secondary" onClick={() => void toggleQuarantine()}>
            {item.quarantined ? 'Liberar para o kNN' : 'Voltar para quarentena'}
          </button>
          <button onClick={() => void process()} disabled={busy === 'process' || photos.length === 0}>
            Processar peça
          </button>
        </div>
      </div>

      {job ? (
        <div className="card" style={{ marginTop: 12 }}>
          Processamento: <strong>{job.status}</strong>
          {job.stage ? ` · ${job.stage} (${job.progress}%)` : null}
          {job.error ? <span style={{ color: 'var(--red)' }}> · {job.error}</span> : null}
        </div>
      ) : null}

      <h2>Ficha</h2>
      <div className="card">
        <div className="grid cols-4">
          <Field label="SKU" value={item.sku} />
          <Field label="Cor" value={item.colorway} />
          <Field label="Coleção" value={item.collection} />
          <Field label="Ano" value={item.release_year} />
          <Field label="País" value={item.country} />
          <Field label="Tamanho" value={item.size_label} />
          <Field label="Material" value={item.material} />
          <Field label="Gênero" value={item.gender} />
        </div>
        {item.notes_md ? <p className="muted" style={{ marginTop: 12 }}>{item.notes_md}</p> : null}
        <p className="muted" style={{ marginTop: 8 }}>
          {versions.length} versões anteriores preservadas
          {versions.length > 0
            ? ` · última alteração ${new Date(versions[0]!.changed_at).toLocaleString('pt-BR')}`
            : ''}
        </p>
      </div>

      <h2>Fotos por região</h2>
      {REFERENCE_REGIONS.map(({ region, label }) => {
        const regionPhotos = byRegion.get(region) ?? [];
        return (
          <div key={region} className="card" style={{ marginBottom: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>
                {label} <span className="muted">({regionPhotos.length})</span>
              </strong>
              <label className="btn secondary" style={{ margin: 0, cursor: 'pointer' }}>
                {busy === region ? 'Enviando…' : '+ Fotos'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  disabled={busy === region}
                  onChange={(e) => void upload(region, e.target.files)}
                />
              </label>
            </div>
            {regionPhotos.length > 0 ? (
              <div className="photos" style={{ marginTop: 10 }}>
                {regionPhotos.map((photo) => (
                  <div key={photo.id} className="photo">
                    {photo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.url} alt={label} onClick={() => void showSimilar(photo)} />
                    ) : null}
                    <div className="caption">
                      <span>{label}</span>
                      <span title="clique na foto para ver similares">kNN</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {similar ? (
        <div className="card" style={{ borderColor: 'var(--lime)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Similares por embedding — {similar.photo.region}</strong>
            <button className="secondary" onClick={() => setSimilar(null)}>
              Fechar
            </button>
          </div>
          {similar.rows.length === 0 ? (
            <p className="muted">Sem embeddings comparáveis ainda (processe outras peças).</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Peça</th>
                  <th>Tipo</th>
                  <th>Similaridade</th>
                </tr>
              </thead>
              <tbody>
                {similar.rows.map((row) => (
                  <tr key={row.photo_id}>
                    <td>
                      <a href={`/references/${row.reference_item_id}`}>
                        {[row.brand_name, row.product_name].filter(Boolean).join(' ') || 'Peça'}
                      </a>
                    </td>
                    <td>
                      <span className={`pill ${row.authenticity}`}>
                        {row.authenticity === 'authentic' ? 'Original' : 'Réplica'}
                      </span>
                    </td>
                    <td>{Math.round(Number(row.similarity) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      <h2>Modo especialista — anotações</h2>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          void addAnnotation(new FormData(form)).then(() => form.reset());
        }}
      >
        <div className="grid cols-4">
          <div>
            <label>Aspecto</label>
            <select name="aspect" defaultValue="stitching">
              {Object.entries(ANNOTATION_ASPECT_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Avaliação</label>
            <select name="assessment" defaultValue="correct">
              {Object.entries(ANNOTATION_ASSESSMENT_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Foto (opcional)</label>
            <select name="photo_id" defaultValue="">
              <option value="">Peça inteira</option>
              {photos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {photo.region}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={{ width: '100%' }}>
              Anotar
            </button>
          </div>
        </div>
        <label>Observação</label>
        <input name="note" placeholder="ex.: bordado desalinhado no S do logo" />
      </form>

      {annotations.length > 0 ? (
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Aspecto</th>
              <th>Avaliação</th>
              <th>Observação</th>
              <th>Quando</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {annotations.map((annotation) => (
              <tr key={annotation.id}>
                <td>
                  {ANNOTATION_ASPECT_LABELS[
                    annotation.aspect as keyof typeof ANNOTATION_ASPECT_LABELS
                  ] ?? annotation.aspect}
                </td>
                <td>
                  <span
                    className={`pill ${
                      annotation.assessment === 'correct'
                        ? 'authentic'
                        : annotation.assessment === 'incorrect'
                          ? 'replica'
                          : 'muted'
                    }`}
                  >
                    {ANNOTATION_ASSESSMENT_LABELS[
                      annotation.assessment as keyof typeof ANNOTATION_ASSESSMENT_LABELS
                    ] ?? annotation.assessment}
                  </span>
                </td>
                <td>{annotation.note || '—'}</td>
                <td className="muted">
                  {new Date(annotation.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td>
                  {annotation.created_by === session.user.id ? (
                    <button className="danger" onClick={() => void removeAnnotation(annotation.id)}>
                      remover
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Nenhuma anotação ainda.</p>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <div className="muted">{label}</div>
      <div>{value ?? '—'}</div>
    </div>
  );
}
