# 07 — Design System "Madruga DS"

Referências: Apple (clareza e materialidade), Linear (densidade e precisão), StockX/GOAT (confiança transacional), Grailed (editorial de moda), Nike (atitude). O sistema precisa equilibrar **atitude streetwear** com **seriedade de laudo técnico** — a mesma marca assina um fit pic e um certificado de autenticidade.

## Identidade

- **Nome do sistema:** Madruga DS
- **Personalidade:** técnica, direta, um pé na rua. Nunca infantil, nunca "corporate".
- **Dark-first.** O app é escuro por padrão (fotos de peças saltam sobre fundo escuro, como vitrine); light mode disponível.

## Tokens

### Cor

```
── Núcleo (dark) ──────────────────────────────────────────
bg/base          #0A0A0B     superfície principal
bg/raised        #131316     cards
bg/overlay       #1C1C21     sheets, modais
border/subtle    #26262C
text/primary     #F5F5F6
text/secondary   #A0A0AB
text/tertiary    #63636E

── Marca ──────────────────────────────────────────────────
brand/lime       #C8F04A     ação primária, selo — "verde madruga"
brand/lime-press #B2D93E
brand/ink        #0A0A0B     texto sobre lime

── Semântica de risco (o coração do produto) ─────────────
risk/low         #34C77B     🟢 baixo risco
risk/medium      #F5B942     🟡 médio risco
risk/high        #F0564A     🔴 alto risco
risk/inconclusive#8E8E99     ⚪ inconclusivo
verified/shield  #C8F04A     selo Garimpo Verified

── Feedback ───────────────────────────────────────────────
success #34C77B  warning #F5B942  danger #F0564A  info #5AA7F0
```

Regra: **cores de risco são reservadas** — nunca usar verde/amarelo/vermelho de risco para outra coisa (ex.: badge de promoção). A leitura instantânea do risco é sagrada.

### Tipografia

```
Display:  "Archivo Expanded"  — títulos, números de score (peso 600–800)
Texto:    "Inter"             — UI e corpo (400/500/600)
Mono:     "JetBrains Mono"    — seriais, códigos de certificado, medidas

Escala (mobile):
display-xl 34/40 800   score do laudo
title-lg   24/30 700   títulos de tela
title      18/24 600   cards, seções
body       15/22 400   texto corrente
caption    13/18 500   metadados, labels
mono-sm    13/18 500   GM-7F3K-9Q2A, SKUs
```

### Espaço, raio, elevação

```
space: 4 8 12 16 20 24 32 40 48       (base 4)
radius: sm 8 · md 12 · lg 16 · xl 24 · pill 999
elevação: dark-first → elevação = cor de fundo mais clara + borda sutil,
          sombras só no light mode
touch target mínimo: 44×44
```

### Movimento

```
micro (press, toggle):        120ms  ease-out
transição de tela:            240ms  spring suave (Reanimated)
score do laudo:               contagem 0→92% em 800ms + anel preenchendo
                              (momento "uau" do produto — investir aqui)
haptics: sucesso do check = notificação de sucesso; foto validada = tick leve
```

## Componentes-chave

| Componente       | Notas                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| `RiskBadge`      | pill com cor semântica + label ("Baixo risco"); variantes sm/lg              |
| `ScoreRing`      | anel de progresso com % central, animado, cor pelo risco                     |
| `VerifiedShield` | selo 🛡️ lime; variantes: inline, card, watermark de foto                     |
| `FindingCard`    | achado do laudo: ícone ✓/⚠, texto, expande p/ foto com bbox                  |
| `CompareSlider`  | lado a lado sua peça × referência, zoom sincronizado, divisor arrastável     |
| `CameraOverlay`  | moldura tracejada por região + dica + validação em tempo real                |
| `PriceSlider`    | slider mín—premium com feedback de tempo de venda ao vivo                    |
| `ListingCard`    | foto, selo, preço, tamanho; grid 2 col                                       |
| `CertPage`       | layout do certificado público (web) — imprime bem, funciona como "documento" |
| `EmptyState`     | ilustrado, sempre com ação ("Nenhum check ainda → Fazer o primeiro")         |

## Tom de voz (pt-BR)

- **Direto e honesto**: "92% de probabilidade de autenticidade", nunca "É original!".
- **Sem acusar**: risco alto = "encontramos desvios em relação às nossas referências", nunca "sua peça é falsa" (implicação legal e emocional — ver doc 17).
- **Gíria com parcimônia**: "garimpo", "achado", "fit" pertencem ao vocabulário; evitar forçar slang em fluxo transacional/laudo.
- Botões com verbo: "Fazer Legit Check", "Anunciar por R$ 1.450", "Liberar pagamento".

## Acessibilidade

- Contraste AA mínimo em todos os pares (lime sobre ink passa AAA).
- Risco nunca comunicado só por cor: sempre ícone + texto (🟢 + "Baixo risco").
- Dynamic type até 120% sem quebra nas telas core.
- Labels de acessibilidade em fotos do laudo ("foto da etiqueta de gola com marcação no canto superior").

## Implementação

- Tokens em pacote compartilhado `packages/ui-tokens` (TS + JSON), consumido pelo app (NativeWind/Tamagui) e web (Tailwind preset).
- Componentes RN em `packages/ui` com Storybook (react-native-storybook) e testes de snapshot.
- Ícones: Lucide + set proprietário para domínio (selo, etiqueta, costura, autenticidade).
