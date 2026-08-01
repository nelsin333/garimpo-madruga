-- Sprint 2: categorias do wizard com checklist próprio, produtos (modelos)
-- e marcas/modelos adicionados por usuários.

alter type public.check_status add value if not exists 'failed';

-- Checklist de fotos passa a morar na CATEGORIA (default) com override
-- opcional por marca em brands.photo_checklist (mesma chave de slug).
alter table public.categories
  add column if not exists photo_checklist jsonb not null default '[]'::jsonb,
  add column if not exists display_order int;

comment on column public.categories.display_order is
  'Posição no wizard de novo check; null = não aparece no wizard.';

-- Categorias do wizard (idempotente — não depende do seed ter rodado antes).
insert into public.categories (name, slug) values
  ('Camiseta', 'camiseta'),
  ('Hoodie', 'hoodie'),
  ('Crewneck', 'crewneck'),
  ('Jaqueta', 'jaqueta'),
  ('Calça', 'calca'),
  ('Shorts', 'shorts'),
  ('Tênis', 'tenis'),
  ('Boné', 'bone'),
  ('Bolsa', 'bolsa'),
  ('Outro', 'outro')
on conflict (slug) do nothing;

update public.categories set display_order = v.ord
from (values
  ('camiseta', 1), ('hoodie', 2), ('crewneck', 3), ('jaqueta', 4), ('calca', 5),
  ('shorts', 6), ('tenis', 7), ('bone', 8), ('bolsa', 9), ('outro', 10)
) as v(slug, ord)
where categories.slug = v.slug;

-- Checklists por categoria. Steps validados por photoChecklistSchema
-- (@garimpo/contracts). Opcionais: qr/tag/embalagem/nota/defeitos.
update public.categories set photo_checklist = v.checklist::jsonb
from (values
  ('camiseta', $$[
    {"region":"front","label":"Frente inteira","hint":"Peça inteira, bem iluminada, fundo neutro.","required":true},
    {"region":"back","label":"Costas","hint":"Peça inteira vista por trás.","required":true},
    {"region":"neck_tag","label":"Etiqueta principal","hint":"Aproxime a ~10cm. A etiqueta deve preencher a moldura.","required":true},
    {"region":"wash_tag","label":"Etiqueta de composição","hint":"Todas as linhas de texto legíveis.","required":true},
    {"region":"collar_stitch","label":"Costura da gola","hint":"Close da costura interna da gola.","required":true},
    {"region":"hem_stitch","label":"Costura da barra","hint":"Close da costura da barra inferior.","required":true},
    {"region":"logo","label":"Logo","hint":"Macro do logo principal.","required":true},
    {"region":"print","label":"Estampa","hint":"Detalhe da estampa em ângulo reto.","required":true},
    {"region":"qr_code","label":"QR Code","hint":"QR ou código de barras da etiqueta, se existir.","required":false},
    {"region":"hang_tag","label":"Tag","hint":"Tag pendurada frente e verso, se tiver.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito, mancha ou desgaste.","required":false}
  ]$$),
  ('hoodie', $$[
    {"region":"front","label":"Frente inteira","hint":"Peça inteira, capuz aberto, bem iluminada.","required":true},
    {"region":"back","label":"Costas","hint":"Peça inteira vista por trás.","required":true},
    {"region":"neck_tag","label":"Etiqueta principal","hint":"Aproxime a ~10cm. A etiqueta deve preencher a moldura.","required":true},
    {"region":"wash_tag","label":"Etiqueta de composição","hint":"Todas as linhas de texto legíveis.","required":true},
    {"region":"embroidery","label":"Bordado / logo","hint":"Macro do bordado, foque nos pontos.","required":true},
    {"region":"cuffs","label":"Punhos","hint":"Close do ribbing do punho.","required":true},
    {"region":"hem_stitch","label":"Costura da barra","hint":"Close da costura e do ribbing da barra.","required":true},
    {"region":"zipper","label":"Zíper","hint":"Puller e trilho do zíper, se tiver.","required":false},
    {"region":"qr_code","label":"QR Code","hint":"QR ou código de barras da etiqueta, se existir.","required":false},
    {"region":"hang_tag","label":"Tag","hint":"Tag pendurada frente e verso, se tiver.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito, mancha ou desgaste.","required":false}
  ]$$),
  ('crewneck', $$[
    {"region":"front","label":"Frente inteira","hint":"Peça inteira, bem iluminada, fundo neutro.","required":true},
    {"region":"back","label":"Costas","hint":"Peça inteira vista por trás.","required":true},
    {"region":"neck_tag","label":"Etiqueta principal","hint":"Aproxime a ~10cm. A etiqueta deve preencher a moldura.","required":true},
    {"region":"wash_tag","label":"Etiqueta de composição","hint":"Todas as linhas de texto legíveis.","required":true},
    {"region":"collar_stitch","label":"Costura da gola","hint":"Close do ribbing e da costura da gola.","required":true},
    {"region":"embroidery","label":"Bordado / logo","hint":"Macro do bordado, foque nos pontos.","required":true},
    {"region":"cuffs","label":"Punhos","hint":"Close do ribbing do punho.","required":true},
    {"region":"hem_stitch","label":"Costura da barra","hint":"Close da costura e do ribbing da barra.","required":true},
    {"region":"qr_code","label":"QR Code","hint":"QR ou código de barras da etiqueta, se existir.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito, mancha ou desgaste.","required":false}
  ]$$),
  ('jaqueta', $$[
    {"region":"front","label":"Frente inteira","hint":"Peça fechada, bem iluminada.","required":true},
    {"region":"back","label":"Costas","hint":"Peça inteira vista por trás.","required":true},
    {"region":"neck_tag","label":"Etiqueta principal","hint":"Aproxime a ~10cm. A etiqueta deve preencher a moldura.","required":true},
    {"region":"wash_tag","label":"Etiqueta de composição","hint":"Todas as linhas de texto legíveis.","required":true},
    {"region":"zipper","label":"Zíper","hint":"Puller e trilho do zíper principal.","required":true},
    {"region":"lining","label":"Forro","hint":"Interior da jaqueta com o forro visível.","required":true},
    {"region":"logo","label":"Logo","hint":"Macro do logo ou patch principal.","required":true},
    {"region":"cuffs","label":"Punhos","hint":"Close do acabamento do punho.","required":true},
    {"region":"buttons","label":"Botões","hint":"Close dos botões ou snaps, se tiver.","required":false},
    {"region":"serial","label":"Serial","hint":"Etiqueta de serial/art code, se existir.","required":false},
    {"region":"qr_code","label":"QR Code","hint":"QR ou NFC tag, se existir.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito, mancha ou desgaste.","required":false}
  ]$$),
  ('calca', $$[
    {"region":"front","label":"Frente inteira","hint":"Peça esticada, bem iluminada.","required":true},
    {"region":"back","label":"Costas","hint":"Peça inteira vista por trás.","required":true},
    {"region":"size_tag","label":"Etiqueta da cintura","hint":"Etiqueta interna da cintura preenchendo a moldura.","required":true},
    {"region":"wash_tag","label":"Etiqueta de composição","hint":"Todas as linhas de texto legíveis.","required":true},
    {"region":"buttons","label":"Botão / rebites","hint":"Close do botão principal e rebites.","required":true},
    {"region":"zipper","label":"Zíper","hint":"Puller e trilho do zíper.","required":true},
    {"region":"pocket_stitch","label":"Costura do bolso","hint":"Close da costura do bolso traseiro.","required":true},
    {"region":"hem_stitch","label":"Barra","hint":"Close da costura da barra.","required":true},
    {"region":"hang_tag","label":"Tag","hint":"Tag pendurada frente e verso, se tiver.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito, mancha ou desgaste.","required":false}
  ]$$),
  ('shorts', $$[
    {"region":"front","label":"Frente inteira","hint":"Peça esticada, bem iluminada.","required":true},
    {"region":"back","label":"Costas","hint":"Peça inteira vista por trás.","required":true},
    {"region":"size_tag","label":"Etiqueta da cintura","hint":"Etiqueta interna da cintura preenchendo a moldura.","required":true},
    {"region":"wash_tag","label":"Etiqueta de composição","hint":"Todas as linhas de texto legíveis.","required":true},
    {"region":"logo","label":"Logo","hint":"Macro do logo ou bordado.","required":true},
    {"region":"hem_stitch","label":"Barra","hint":"Close da costura da barra.","required":true},
    {"region":"qr_code","label":"QR Code","hint":"QR ou código de barras da etiqueta, se existir.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito, mancha ou desgaste.","required":false}
  ]$$),
  ('tenis', $$[
    {"region":"front","label":"Lateral externa","hint":"Par ou pé único, perfil completo.","required":true},
    {"region":"back","label":"Traseira","hint":"Heel tab e costura traseira visíveis.","required":true},
    {"region":"size_tag","label":"Etiqueta interna","hint":"Etiqueta de tamanho dentro da língua, sem sombra.","required":true},
    {"region":"insole","label":"Palmilha","hint":"Retire a palmilha e fotografe frente e verso.","required":true},
    {"region":"outsole","label":"Solado","hint":"Sola completa, limpa se possível.","required":true},
    {"region":"stitching","label":"Costura do toebox","hint":"Close da costura frontal.","required":true},
    {"region":"heel_tab","label":"Heel tab","hint":"Macro do detalhe do calcanhar.","required":true},
    {"region":"box_label","label":"Etiqueta da caixa","hint":"Etiqueta lateral da caixa com SKU.","required":false},
    {"region":"receipt","label":"Nota fiscal","hint":"Comprovante de compra, se tiver.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito ou desgaste.","required":false}
  ]$$),
  ('bone', $$[
    {"region":"front","label":"Frente","hint":"Boné de frente, bordado visível.","required":true},
    {"region":"back","label":"Traseira","hint":"Fecho e ajuste visíveis.","required":true},
    {"region":"interior_label","label":"Etiqueta interna","hint":"Etiqueta interna preenchendo a moldura.","required":true},
    {"region":"embroidery","label":"Bordado","hint":"Macro do bordado frontal, foque nos pontos.","required":true},
    {"region":"stitching","label":"Costura da aba","hint":"Close da costura da aba.","required":true},
    {"region":"hang_tag","label":"Tag / sticker","hint":"Tag ou sticker, se tiver.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito ou desgaste.","required":false}
  ]$$),
  ('bolsa', $$[
    {"region":"front","label":"Frente","hint":"Bolsa inteira, bem iluminada.","required":true},
    {"region":"back","label":"Traseira","hint":"Bolsa inteira vista por trás.","required":true},
    {"region":"interior_label","label":"Etiqueta interna","hint":"Etiqueta interna preenchendo a moldura.","required":true},
    {"region":"logo","label":"Logo","hint":"Macro do logo ou monograma.","required":true},
    {"region":"hardware","label":"Ferragens","hint":"Close de fivelas, argolas e fechos.","required":true},
    {"region":"stitching","label":"Costura","hint":"Close da costura principal.","required":true},
    {"region":"zipper","label":"Zíper","hint":"Puller e trilho do zíper.","required":true},
    {"region":"serial","label":"Serial","hint":"Número de série ou date code, se existir.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito ou desgaste.","required":false}
  ]$$),
  ('outro', $$[
    {"region":"front","label":"Frente","hint":"Peça inteira, bem iluminada.","required":true},
    {"region":"back","label":"Costas","hint":"Peça inteira vista por trás.","required":true},
    {"region":"neck_tag","label":"Etiqueta principal","hint":"Etiqueta principal, se existir.","required":false},
    {"region":"wash_tag","label":"Etiqueta de composição","hint":"Etiqueta de composição, se existir.","required":false},
    {"region":"logo","label":"Logo","hint":"Macro do logo principal.","required":false},
    {"region":"serial","label":"Serial","hint":"Serial ou código, se existir.","required":false},
    {"region":"defects","label":"Defeitos","hint":"Qualquer defeito ou desgaste.","required":false}
  ]$$)
) as v(slug, checklist)
where categories.slug = v.slug;

-- Produtos (modelos) — catálogo + contribuições de usuários.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  category_id uuid references public.categories (id),
  name text not null,
  style_code text,
  colorway text,
  release_year int,
  source text not null default 'catalog' check (source in ('catalog', 'user')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create unique index products_brand_name_unique
  on public.products (brand_id, lower(name)) where category_id is null;
create unique index products_brand_cat_name_unique
  on public.products (brand_id, category_id, lower(name)) where category_id is not null;
create index products_name_trgm on public.products using gin (name extensions.gin_trgm_ops);

alter table public.products enable row level security;

create policy "products_select_all" on public.products for select using (true);

-- Usuário pode contribuir modelo (sempre marcado como source=user).
create policy "products_insert_user" on public.products
  for insert with check (auth.uid() = created_by and source = 'user');

-- Marcas também podem ser adicionadas por usuários (tier 3 = sob demanda).
alter table public.brands add column if not exists created_by uuid references public.profiles (id);

create policy "brands_insert_user" on public.brands
  for insert with check (auth.uid() = created_by and tier = 3);

-- Check aponta para o modelo identificado/declarado.
alter table public.checks
  add column if not exists product_id uuid references public.products (id);
