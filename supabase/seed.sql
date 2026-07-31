-- Seed do catálogo: categorias e as 10 marcas foco do MVP com checklists de fotos.
-- Idempotente (on conflict do nothing) para rodar em qualquer ambiente.

insert into public.categories (name, slug) values
  ('Tênis', 'tenis'),
  ('Camiseta', 'camiseta'),
  ('Moletom', 'moletom'),
  ('Jaqueta', 'jaqueta'),
  ('Boné', 'bone'),
  ('Acessório', 'acessorio')
on conflict (slug) do nothing;

-- Checklists base por categoria (JSON validado por photoChecklistSchema).
-- Marcas tier 1 podem sobrescrever com passos específicos depois.
with base as (
  select
    $$[
      {"region":"front","label":"Frente","hint":"Peça inteira, bem iluminada, fundo neutro.","required":true},
      {"region":"back","label":"Costas","hint":"Peça inteira vista por trás.","required":true},
      {"region":"neck_tag","label":"Etiqueta de gola","hint":"Aproxime a ~10cm. A etiqueta deve preencher a moldura.","required":true},
      {"region":"wash_tag","label":"Etiqueta de lavagem","hint":"Todas as linhas de texto legíveis.","required":true},
      {"region":"logo","label":"Logo / bordado","hint":"Macro do logo, foque nos pontos do bordado.","required":true},
      {"region":"stitching","label":"Costura","hint":"Close da costura da barra ou do bolso.","required":true},
      {"region":"size_tag","label":"Tag de tamanho / serial","hint":"Código de barras e números nítidos.","required":true},
      {"region":"packaging","label":"Embalagem","hint":"Sacola, caixa ou tags extras, se tiver.","required":false},
      {"region":"receipt","label":"Nota fiscal","hint":"Comprovante de compra, se tiver.","required":false}
    ]$$::jsonb as apparel,
    $$[
      {"region":"front","label":"Lateral externa","hint":"Par ou pé único, perfil completo.","required":true},
      {"region":"back","label":"Traseira","hint":"Heel tab e costura traseira visíveis.","required":true},
      {"region":"size_tag","label":"Etiqueta interna","hint":"Etiqueta de tamanho dentro da língua, sem sombra.","required":true},
      {"region":"insole","label":"Palmilha","hint":"Retire a palmilha e fotografe frente e verso.","required":true},
      {"region":"outsole","label":"Solado","hint":"Sola completa, limpa se possível.","required":true},
      {"region":"stitching","label":"Costura do toebox","hint":"Close da costura frontal.","required":true},
      {"region":"heel_tab","label":"Heel tab","hint":"Macro do detalhe do calcanhar.","required":true},
      {"region":"box_label","label":"Etiqueta da caixa","hint":"Etiqueta lateral da caixa com SKU.","required":false},
      {"region":"receipt","label":"Nota fiscal","hint":"Comprovante de compra, se tiver.","required":false}
    ]$$::jsonb as sneaker
)
insert into public.brands (name, slug, aliases, tier, photo_checklist)
select b.name, b.slug, b.aliases, b.tier,
  jsonb_build_object(
    'tenis', base.sneaker,
    'camiseta', base.apparel,
    'moletom', base.apparel,
    'jaqueta', base.apparel,
    'bone', base.apparel,
    'acessorio', base.apparel
  )
from base,
  (values
    ('Nike', 'nike', array['nike sb', 'jordan', 'air jordan', 'nike acg'], 1),
    ('Adidas', 'adidas', array['adidas originals', 'yeezy'], 1),
    ('Supreme', 'supreme', array['sup'], 1),
    ('Stussy', 'stussy', array['stüssy'], 1),
    ('Palace', 'palace', array['palace skateboards'], 1),
    ('Bape', 'bape', array['a bathing ape'], 1),
    ('Carhartt', 'carhartt', array['carhartt wip'], 1),
    ('Stone Island', 'stone-island', array['stone'], 1),
    ('Oakley', 'oakley', array['oakley software'], 1),
    ('Lacoste', 'lacoste', array[]::text[], 1)
  ) as b(name, slug, aliases, tier)
on conflict (slug) do nothing;
