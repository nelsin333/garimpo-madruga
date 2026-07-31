# 08 — Sistema de IA de Autenticação

O sistema NÃO é "um modelo que diz real/fake". É um **pipeline de evidências**: vários analisadores especializados produzem achados (findings) com scores parciais, um agregador calibrado produz a probabilidade final, e uma política de decisão define se o veredito sai automático ou vai para humano. Explicabilidade não é acessório — é o produto (o laudo É a lista de achados).

```
fotos ──► [0 Qualidade/Antifraude] ──► [1 Identificação] ──► [2 Extração por região]
                                                                     │
      ┌──────────────────────────────────────────────────────────────┤
      ▼                ▼                 ▼                ▼          ▼
 [3a OCR/Serial] [3b Embeddings+kNN] [3c Tipografia] [3d Costura] [3e QR/NFC]
      └──────────────┴───────┬────────┴────────────────┴──────────┘
                             ▼
                [4 Análise multimodal (LLM) com RAG de referências]
                             ▼
                [5 Agregador + calibração] ──► P(autêntica) + achados
                             ▼
                [6 Política de decisão]
                   ├─ P ≥ τ_alto e cobertura ok ──► veredito automático
                   ├─ zona incerta ──► fila de revisão humana
                   └─ P ≤ τ_baixo ──► humano confirma antes de publicar
```

## Estágio 0 — Qualidade e antifraude de imagem

- **Qualidade**: blur (variância do Laplaciano), exposição, resolução mínima, enquadramento (a região pedida está presente? — detector leve YOLO/DETR fine-tunado). Feedback **na hora da captura**, não depois: refazer foto no ato é a maior alavanca de precisão do sistema inteiro.
- **Antifraude**: detecção de foto-de-foto/tela (padrão moiré, bordas de dispositivo, reflexo), EXIF inconsistente (foto de galeria antiga vs. capturada agora — o app marca capturas in-app), pHash contra fotos já vistas (mesma foto usada em outro check/conta = flag forte).

## Estágio 1 — Identificação da peça

- Embedding global da foto de frente → kNN em `products` (imagens de catálogo) → candidatos de modelo/colorway.
- LLM multimodal confirma/desambigua ("é Box Logo FW23 ou FW17? justifique pelos detalhes X, Y").
- Se identificação diverge do declarado pelo usuário → finding "declaração inconsistente" (peso no risco).
- Output: `product_id` + era/temporada (define QUAIS referências e QUAL guia de autenticação usar — cada marca/era tem pontos de verificação diferentes).

## Estágio 2 — Extração por região

Detector de regiões (fine-tune de um DETR/YOLOv10 leve) recorta e normaliza (deskew, correção de perspectiva) cada região de interesse: etiqueta de gola, etiqueta de lavagem, logo/bordado, costuras específicas, zíper/puller, botões, serial/tag, sole/entressola (tênis), caixa. Cada crop segue para os analisadores.

## Estágio 3 — Analisadores especializados

### 3a. OCR + validação de serial

- Google Cloud Vision (ou PaddleOCR self-hosted para custo) sobre etiquetas e tags.
- Texto extraído validado contra `reference_items.serial_format`: formato do serial por marca/era (regex + checksums quando existirem), país de fabricação plausível para a temporada, códigos de fábrica conhecidos, erros clássicos de réplica (caracteres trocados, acentuação errada em "made in", datas impossíveis).
- Serial duplicado no nosso banco (mesmo serial em duas peças físicas diferentes) = flag fortíssima.

### 3b. Embeddings + kNN (o coração comparativo)

- **Modelo**: começar com SigLIP 2 / OpenCLIP pré-treinado; depois **fine-tune com triplet/ArcFace loss** sobre nossos pares (autêntica ↔ autêntica perto; autêntica ↔ réplica longe) — é aqui que o banco proprietário vira vantagem de modelo.
- **Um embedding por região, não por peça**: etiqueta tem espaço vetorial próprio, costura outro. Comparar globalmente dilui o sinal (réplica boa acerta a silhueta e erra o detalhe).
- Armazenamento: `pgvector` com índice HNSW, filtrado por `brand_id + category_id + region + era` antes do kNN (ver doc 04).
- Sinais extraídos do kNN:
  - distância média aos k autênticos mais próximos vs. distância aos k réplicas mais próximas (temos exemplares de réplica catalogados — LR ratio simples e poderoso);
  - densidade local (região do espaço com muitas referências = confiança alta; deserto = inconclusivo honesto).

### 3c. Tipografia e logos

- Crop da etiqueta → segmentação de caracteres → métricas geométricas: espaçamento entre letras (kerning), proporção altura/largura, peso do traço, alinhamento da linha de base, serifa/terminações.
- Comparação com gabarito da marca/era (medido a partir das referências, guardado em `reference_items.notes_md` + features numéricas).
- Réplicas erram sistematicamente tipografia em 1–3%: invisível a olho nu, trivial para métrica geométrica **desde que o crop esteja normalizado** (por isso o estágio 2 importa tanto).
- Logos/bordados: embedding específico + análise de densidade de pontos do bordado (transformada de Fourier no crop pega regularidade do ponto; bordado industrial de réplica tem assinatura espectral diferente).

### 3d. Costura e materiais

- Densidade de pontos por cm (contagem via detecção de picos ao longo da linha de costura), regularidade (desvio-padrão do espaçamento), simetria entre lados.
- Textura do tecido: features de textura (Gabor/embedding fino) comparadas às referências da mesma era — réplica usa malha de gramatura diferente que muda a micro-textura.
- Limitação honesta: costura é sensível a foto ruim → esses achados têm peso menor e nunca decidem sozinhos.

### 3e. QR / NFC / tags

- QR de marca: decodificar, validar formato/URL esperada da era (réplicas usam QR que resolve para domínio errado ou não resolve).
- NFC (quando existir — app lê via `react-native-nfc-manager`): validar payload contra formato conhecido da marca. Nota: NFC clonado existe; NFC válido soma pouco, NFC inválido subtrai muito (assimetria correta).

## Estágio 4 — Análise multimodal (LLM) com RAG

- **RAG de conhecimento de autenticação**: para a marca/modelo/era identificados, recuperar (a) guia curado de pontos de verificação (`brands.auth_guide` + notas de especialista), (b) top-k fotos de referência autênticas e de réplicas conhecidas.
- Prompt estruturado para Claude (visão): fotos do usuário + referências lado a lado + guia + outputs numéricos dos estágios 3a–3e → o modelo produz **achados qualitativos com justificativa em pt-BR** ("o bordado do logo apresenta pontos mais espaçados na curva do 'S' em comparação à referência FW23") + score por achado, em JSON validado (schema).
- Papel do LLM: **integrar evidências e escrever o laudo explicável** — não é o juiz final sozinho. Os scores numéricos dos estágios 3 entram no agregador com pesos próprios; o LLM cobre o "cauda longa" de sinais que não temos analisador dedicado ainda.
- Anti-alucinação: o LLM só pode citar achados ancorados em foto (obriga bbox por achado); achados sem âncora são descartados; temperatura baixa; validação de schema.

## Estágio 5 — Agregação e calibração

- Agregador: começa como **regressão logística/gradient boosting** sobre o vetor de features (todos os scores parciais + metadados: cobertura do checklist, qualidade das fotos, densidade de referências). Simples, auditável, rápido de retreinar.
- **Calibração é inegociável**: Platt scaling / isotonic regression sobre conjunto de validação rotulado por humanos, recalibrado mensalmente. "92%" TEM que significar ~92% de frequência real — a marca é a honestidade estatística.
- Score final + mapeamento para risco:
  - `P ≥ 0.90` e cobertura completa → 🟢 baixo risco
  - `0.70 ≤ P < 0.90` → 🟡 médio risco
  - `P < 0.70` → 🔴 alto risco
  - cobertura insuficiente / deserto de referências → ⚪ inconclusivo (reembolso parcial, pedir fotos, nunca chutar)

## Estágio 6 — Política de decisão + revisão humana

- **Fase 1 (MVP)**: 100% dos checks passam por humano; IA pré-preenche o laudo. Objetivo: coletar rótulos e medir concordância IA×humano por marca/categoria.
- **Fase 2**: auto-veredito onde a concordância histórica ≥ 99% **naquela fatia** (marca × categoria × faixa de score). Liberação por fatia, não global.
- **Fase 3 (estado alvo)**: ~70–85% automático; humano cuida da zona incerta, alto valor (> R$ 3k sempre tem humano), marcas novas, e auditoria amostral contínua (5% dos automáticos re-revisados às cegas → mede drift).
- **Active learning**: casos onde IA e humano divergem entram no conjunto de treino com peso alto; casos de máxima incerteza são priorizados para rotulagem.
- Contestação do usuário: segunda revisão por revisor sênior diferente; se veredito muda, caso vira ouro de treino e usuário é reembolsado.

## Como treinar (bootstrapping → melhoria contínua)

1. **Frio (mês 0)**: sem modelo próprio. Guias de autenticação curados manualmente (parceria com autenticadores experientes) + LLM multimodal + OCR + regras de serial. Humano decide tudo.
2. **Semente (meses 0–3)**: banco de referência inicial: peças próprias fotografadas em protocolo padrão (comprar ~200 peças autênticas e ~100 réplicas conhecidas das 10 marcas foco — custo de aquisição de dados, orçar ~R$ 150–250k), acervos de parceiros (lojas de consignação, colecionadores — troca: checks grátis), arquivos de sites de referência com licença.
3. **Fine-tune v1 (mês 3–4)**: com ~30–50k crops rotulados por região, fine-tune do encoder (LoRA sobre SigLIP) com contrastive loss autêntica/réplica. Avaliação: recall de réplica ≥ 98% a FPR fixado por fatia.
4. **Ciclo contínuo**: cada check consentido vira candidato a referência → curadoria (automática por qualidade + amostral humana) → re-embed do banco quando o encoder atualiza (versionar `embeddings.model`; manter as duas versões até migração completa).
5. **Detecção de nova geração de réplica**: monitorar drift — cluster novo de peças "estranhas" da mesma marca/modelo em janela curta = provável batch novo de réplica → comprar exemplar, catalogar, retreinar. Ter orçamento e processo para isso é vantagem operacional permanente.

## Como reduzir falsos positivos (selo em fake — o erro que mata o negócio)

1. Assimetria explícita de custo no treino e nos limiares: FP (aprovar fake) custa 20× FN (mandar original p/ revisão). Limiar de auto-aprovação é conservador por design.
2. Cobertura obrigatória: sem foto de etiqueta interna E serial E costura → nunca "baixo risco", no máximo "médio, evidência incompleta".
3. Referências negativas (réplicas catalogadas) no kNN — a maioria dos sistemas só compara com originais; comparar com fakes conhecidos derruba FP drasticamente.
4. Humano obrigatório em: alto valor, marca/era com < N referências, sinais de fraude no estágio 0, primeira peça de um vendedor.
5. Auditoria amostral cega contínua + recalibração mensal.
6. Garantia financeira (recompra) como backstop — e como métrica: sinistralidade da garantia é o KPI final de precisão.

## Escala

- Embeddings/detecção em GPU serverless (Modal): custo por check ~centavos; latência alvo do pipeline completo < 90s.
- LLM: caching de prompt por marca/era (o guia RAG repete); batch para re-análises noturnas.
- pgvector aguenta dezenas de milhões de vetores com HNSW por partição (brand×region); avaliar migração para índice dedicado (Qdrant) só se p95 do kNN > 100ms.
- Custo estimado por check (V1): OCR ~R$0,05 + GPU ~R$0,15 + LLM ~R$0,80–1,50 + storage ~R$0,02 → margem confortável sobre preço R$ 29–79.
