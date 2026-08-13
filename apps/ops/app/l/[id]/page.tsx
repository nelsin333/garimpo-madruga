'use client';

import { CONDITION_LABELS, formatPriceBRL, type Condition } from '@garimpo/contracts';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PublicListing {
  id: string;
  title: string;
  description_md: string;
  price_cents: number | null;
  condition: Condition | null;
  size_label: string | null;
  location_city: string | null;
  location_state: string | null;
  defects_md: string;
  measurements: Record<string, number>;
  certificates: { public_code: string } | null;
  profiles: { username: string; display_name: string | null } | null;
  listing_photos: { storage_path: string; position: number }[];
}

/** Página pública do anúncio — destino dos links compartilhados. */
export default function PublicListingPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<PublicListing | null | 'missing'>(null);

  useEffect(() => {
    supabase()
      .from('listings')
      .select(
        'id, title, description_md, price_cents, condition, size_label, location_city, location_state, defects_md, measurements, certificates(public_code), profiles!listings_seller_id_fkey(username, display_name), listing_photos(storage_path, position)',
      )
      .eq('id', id)
      .in('status', ['active', 'sold'])
      .maybeSingle()
      .then(({ data }) => setListing((data as unknown as PublicListing | null) ?? 'missing'));
  }, [id]);

  if (listing === null) return <p className="muted">Carregando anúncio…</p>;
  if (listing === 'missing') {
    return (
      <div className="card">
        <h1>Anúncio indisponível</h1>
        <p className="muted">Ele pode ter sido vendido ou removido.</p>
      </div>
    );
  }

  const photos = [...(listing.listing_photos ?? [])].sort((a, b) => a.position - b.position);
  const photoUrl = (path: string) =>
    supabase().storage.from('listing-photos').getPublicUrl(path).data.publicUrl;

  return (
    <>
      <h1>{listing.title}</h1>
      <div className="row">
        {listing.certificates ? <span className="pill authentic">🛡️ Garimpo Verified</span> : null}
        <span className="muted">
          {[
            listing.size_label ? `Tam ${listing.size_label}` : null,
            listing.condition ? CONDITION_LABELS[listing.condition] : null,
            listing.location_city && listing.location_state
              ? `${listing.location_city}/${listing.location_state}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      {photos.length > 0 ? (
        <div className="photos" style={{ marginTop: 16 }}>
          {photos.map((photo) => (
            <div key={photo.storage_path} className="photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(photo.storage_path)} alt={listing.title} />
            </div>
          ))}
        </div>
      ) : null}

      <h2>Preço</h2>
      <div className="stat">
        <div className="value">
          {listing.price_cents != null ? formatPriceBRL(listing.price_cents) : 'a combinar'}
        </div>
        <div className="label">
          {listing.profiles
            ? `vendido por ${listing.profiles.display_name ?? `@${listing.profiles.username}`}`
            : ''}
        </div>
      </div>

      <h2>Descrição</h2>
      <div className="card">
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{listing.description_md}</p>
      </div>

      {Object.keys(listing.measurements ?? {}).length > 0 ? (
        <>
          <h2>Medidas</h2>
          <div className="card">
            {Object.entries(listing.measurements).map(([key, value]) => (
              <div key={key} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">{key.replace(/_cm$/, '').replace(/_/g, ' ')}</span>
                <span>{value} cm</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {listing.defects_md ? (
        <>
          <h2>Defeitos informados</h2>
          <div className="card">
            <p style={{ margin: 0 }}>{listing.defects_md}</p>
          </div>
        </>
      ) : null}

      {listing.certificates ? (
        <p style={{ marginTop: 16 }}>
          <a href={`/cert/${listing.certificates.public_code}`}>
            Ver laudo completo · {listing.certificates.public_code} →
          </a>
        </p>
      ) : null}
    </>
  );
}
