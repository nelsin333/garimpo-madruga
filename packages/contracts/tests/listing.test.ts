import { describe, expect, it } from 'vitest';
import {
  buildExportPackage,
  formatPriceBRL,
  listingEditSchema,
  truncateTitle,
  type ExportListingInput,
} from '../src/listing';

const baseInput: ExportListingInput = {
  title: 'Supreme Box Logo Hoodie FW23 Black tamanho G impecável',
  description_md: 'Hoodie original, usado 2x, sem marcas.',
  price_cents: 145000,
  condition: 'excellent',
  size_label: 'G',
  brand: 'Supreme',
  category: 'Hoodie',
  location_city: 'São Paulo',
  location_state: 'SP',
  hashtags: ['supreme', '#boxlogo', 'streetwear'],
  certificate_code: 'GM-AB12-CD34',
  certificate_url: 'https://garimpomadruga.com.br/cert/GM-AB12-CD34',
};

describe('formatPriceBRL', () => {
  it('formata centavos em BRL', () => {
    expect(formatPriceBRL(145000)).toMatch(/1\.450,00/);
    expect(formatPriceBRL(990)).toMatch(/9,90/);
  });
});

describe('truncateTitle', () => {
  it('mantém títulos curtos e corta longos em limite de palavra', () => {
    expect(truncateTitle('Nike Dunk Low', 60)).toBe('Nike Dunk Low');
    const long = truncateTitle(baseInput.title, 30);
    expect(long.length).toBeLessThanOrEqual(31);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });
});

describe('buildExportPackage', () => {
  it('gera pacote com specs, certificado e hashtags para Enjoei', () => {
    const pkg = buildExportPackage('enjoei', baseInput);
    expect(pkg.title.length).toBeLessThanOrEqual(61);
    expect(pkg.body).toContain('Marca: Supreme');
    expect(pkg.body).toContain('Tamanho: G');
    expect(pkg.body).toContain('Condição: Excelente');
    expect(pkg.body).toContain('GM-AB12-CD34');
    expect(pkg.body).toContain('#supreme');
    expect(pkg.body).toContain('#boxlogo'); // não duplica o '#'
    expect(pkg.body).not.toContain('##');
    expect(pkg.price).toMatch(/1\.450,00/);
    expect(pkg.instructions).toContain('Enjoei');
  });

  it('OLX não recebe hashtags', () => {
    const pkg = buildExportPackage('olx', baseInput);
    expect(pkg.body).not.toContain('#supreme');
  });

  it('funciona sem certificado e sem localização', () => {
    const pkg = buildExportPackage('droper', {
      ...baseInput,
      certificate_code: null,
      certificate_url: null,
      location_city: null,
      location_state: null,
    });
    expect(pkg.body).not.toContain('certificado');
    expect(pkg.body).not.toContain('Local:');
  });
});

describe('listingEditSchema', () => {
  const valid = {
    title: 'Supreme Box Logo Hoodie FW23',
    description_md: 'Peça original comprada na loja, pouco uso.',
    condition: 'excellent',
    size_label: 'G',
    price_cents: 145000,
    location_city: 'São Paulo',
    location_state: 'sp',
    shipping_methods: ['correios'],
  };

  it('aceita anúncio válido e normaliza UF', () => {
    const parsed = listingEditSchema.parse(valid);
    expect(parsed.location_state).toBe('SP');
    expect(parsed.hashtags).toEqual([]);
  });

  it('rejeita preço abaixo do mínimo e sem envio', () => {
    expect(listingEditSchema.safeParse({ ...valid, price_cents: 50 }).success).toBe(false);
    expect(listingEditSchema.safeParse({ ...valid, shipping_methods: [] }).success).toBe(false);
  });
});
