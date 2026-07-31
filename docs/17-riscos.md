# 17 — Riscos Técnicos, Legais e Operacionais

## Legais (os que podem matar a empresa — tratar primeiro)

### 1. Responsabilidade pelo veredito errado

**Risco:** selo "baixo risco" em réplica → comprador processa; ou "alto risco" em peça original → vendedor alega dano moral/material (difamação comercial).
**Mitigação:**

- Produto e contrato falam **probabilidade e risco**, nunca certeza ("análise probabilística baseada em referências", disclaimers versionados — `verdicts.disclaimer_version` guarda qual texto o usuário viu).
- Linguagem não acusatória em risco alto: "desvios em relação às referências", nunca "falsificado" (afirmação de fato ilícito exigiria certeza que não temos).
- ToS revisados por advogado: laudo é opinião técnica com limitação de responsabilidade; foro e arbitragem definidos.
- **Garantia Garimpo** transforma o erro residual em custo previsível (reembolso/recompra) em vez de litígio.
- Seguro de responsabilidade civil profissional (E&O) quando houver faturamento relevante.
- Humano obrigatório em alto valor + auditoria contínua (doc 08) mantém o erro raro de fato.

### 2. Marcas registradas (Nike, Supreme, etc.)

**Risco:** marcas notificam por uso de logos/nome; ou alegam que facilitamos venda de falsificados.
**Mitigação:**

- Uso nominativo apenas (identificar a peça é uso legítimo de marca); nunca usar logos na nossa identidade visual/marketing como se fôssemos afiliados; disclaimer de não-afiliação.
- Posicionar-se publicamente como **aliado anti-falsificação** (somos infraestrutura que REMOVE fake do mercado) — buscar diálogo com marcas cedo; V3 inclui recommerce oficial em parceria.
- Peça reprovada não pode ser anunciada no nosso marketplace — política clara e aplicada (estar do lado certo do Código de Defesa do Consumidor e da lei de propriedade industrial).
- Nunca vender/expor o banco de referência (poderia ser lido como "manual de réplica perfeita").

### 3. LGPD

**Risco:** fotos (podem conter ambiente/pessoas), CPF (KYC de vendedor), uso de dados para treino.
**Mitigação:** consentimento explícito e granular p/ treino (`consent_training`); minimização (crops de região, strip de EXIF em derivadas); CPF criptografado (pgsodium) com acesso auditado; DPO nomeado; fluxo de exclusão que remove referência sem quebrar índices (soft delete + re-embed); RIPD (relatório de impacto) do pipeline de IA.

### 4. Marketplace: responsabilidade sobre transações

**Risco:** disputa comprador×vendedor, peça não entregue, chargeback, lavagem via marketplace.
**Mitigação:** escrow obrigatório (dinheiro só libera pós-entrega + janela de disputa); KYC de vendedor (CPF + validação bancária via MP); limites progressivos por reputação; monitoramento de padrões de lavagem (auto-compra, preços absurdos); política de disputa com laudo como âncora; retenção de valores em disputa.

### 5. Integrações com marketplaces terceiros (Enjoei, OLX, Facebook…)

**Risco:** automação não autorizada (login do usuário via app, scraping, postagem robotizada) viola ToS → bloqueio, ações legais, reputação.
**Mitigação (por desenho, já refletida no produto — doc 05):**

- **Só APIs oficiais** onde existirem (Meta/Instagram tem API de conteúdo; WhatsApp via share/Cloud API).
- Onde não houver API: **exportação estruturada + preenchimento assistido** — geramos texto, fotos tratadas e card; o USUÁRIO cola e publica no app de destino (share sheet/deep link). Nenhuma credencial de terceiros passa por nós, nenhum bot posta em nome de ninguém.
- Coleta de comparáveis de preço: manual/curada ou por parceria de dados; sem scraping em violação de ToS.
- Procurar parcerias formais (Enjoei/OLX podem QUERER selo de autenticidade — nosso "risco" é uma BD de negócio).

### 6. Regulatório financeiro

**Risco:** custódia de dinheiro = atividade regulada.
**Mitigação:** nunca custodiar diretamente — split/escrow do Mercado Pago (instituição de pagamento licenciada) até escala que justifique estrutura própria com assessoria regulatória.

## Técnicos

| Risco                                                      | Mitigação                                                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Falso positivo (selo em fake)** — risco existencial      | Toda a seção "reduzir FP" do doc 08: limiares assimétricos, referências negativas, cobertura obrigatória, humano em alto valor, auditoria amostral, backtest como gate de deploy, kill switch por marca |
| **Réplicas evoluem (adversarial)**                         | Processo permanente de compra/catalogação de batches novos; detecção de drift por cluster; o segredo do gabarito (referências nunca públicas)                                                           |
| **Contaminação do banco de referência**                    | Quarentena de referências novas; `quality_score`; curadoria amostral; lineage completo p/ expurgo retroativo                                                                                            |
| **Fraude de submissão** (foto de peça alheia/da internet)  | pHash, EXIF, captura in-app marcada, moiré/foto-de-tela, device fingerprint; certificado vinculado às FOTOS (comprador confere peça × fotos)                                                            |
| **Dependência de LLM externo** (custo/latência/deprecação) | Abstração de provider no estágio 4; sinais numéricos (estágios 3) independem do LLM; prompt caching; avaliação semestral de alternativa self-hosted                                                     |
| **pgvector no limite**                                     | Contrato "kNN filtrado" isolado num módulo → migração p/ Qdrant sem tocar o resto; particionamento por marca antes disso                                                                                |
| **Lock-in Supabase**                                       | É Postgres + storage S3-like padrão; migrations versionadas; sem features exóticas fora RLS/Realtime                                                                                                    |
| **Estouro de custo de IA**                                 | Orçamento por check monitorado (alerta por p95); cache agressivo de prompt; downgrade gracioso (fila mais lenta) em vez de indisponibilidade                                                            |

## Operacionais

| Risco                                                             | Mitigação                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gargalo de revisores humanos** (fila explode com o crescimento) | Automação por fatia (doc 08) cresce junto; painel otimizado p/ tempo-por-caso; rede de autenticadores parceiros (V2); SLA público conservador                                                  |
| **Conhecimento concentrado em poucos autenticadores**             | Todo conhecimento tácito vira `auth_guide` estruturado; pareamento júnior/sênior; duplo-cego que também treina                                                                                 |
| **Cold start do marketplace**                                     | Brechós âncora + acervo de parcerias como inventário inicial; curadoria editorial esconde inventário raso (doc 11)                                                                             |
| **Crise de confiança pública** (um caso viral de selo errado)     | Playbook de crise pronto: reconhecer, reembolsar via garantia, publicar post-mortem técnico (a transparência estatística é a marca — usar o incidente p/ reforçá-la); monitoramento de menções |
| **Logística brasileira** (extravio, "não recebi")                 | Rastreio integrado, seguro de envio opcional embutido, exigência de foto/vídeo de despacho p/ peças > R$ 1k, disputa com prazos claros                                                         |
| **Concorrente internacional entra no Brasil**                     | Velocidade + dados locais (peças BR, vintage nacional, preços em BRL) + Pix/WhatsApp/parcelamento + comunidade — doc 18                                                                        |
