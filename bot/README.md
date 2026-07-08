# Bot de atendimento — Garimpo do Madruga 🤖

Bot de WhatsApp pro Madruga Club. Responde sozinho sobre estoque/tamanho,
data do proximo drop, frete e rastreio de pedido. Qualquer coisa fora disso
(troca, devolucao, autenticidade, negociacao de preco, pergunta aleatoria)
ele escala pro seu WhatsApp pessoal com o historico da conversa.

**Stack:** Node.js + Express | Z-API (WhatsApp) | Supabase (mesmo projeto do site)

## Como funciona

```
Cliente manda msg  →  Z-API dispara webhook  →  POST /webhook/zapi
                                                      │
                                       classifica a intencao (palavra-chave)
                                                      │
              ┌──────────────┬──────────────┬────────┴─────┬──────────────┐
           estoque         drop           frete          rastreio       resto
        (tabela pecas) (bot_config)  (pergunta cidade,  (tabela        escala pro
                                      tabela clientes)   pedidos)      seu WhatsApp
```

- **Estoque**: busca na tabela `pecas` (a mesma do site/admin) com `status = 'disponivel'`.
- **Drop**: le a data da tabela `bot_config` (chave `proximo_drop`). Se estiver vazia,
  calcula sozinho o proximo dia 5 ou 20. Voce atualiza pelo dashboard do Supabase,
  sem mexer em codigo.
- **Frete**: pergunta a cidade primeiro (e salva na tabela `clientes` pra nao perguntar
  de novo). Capital SP/RJ = R$10, interior = R$12–13. Valores tambem editaveis na `bot_config`.
- **Rastreio**: busca na tabela `pedidos` pelo numero do WhatsApp do cliente
  (campos `enviado` e `codigo_rastreio`).
- **Escalonamento**: marca a conversa como "escalada" (bot para de responder aquele
  cliente) e te manda um resumo com as ultimas 10 mensagens. Pra devolver o cliente
  pro bot, responda no WhatsApp do bot: `#liberar 5511999998888`.

## Setup

### 1. Supabase (5 min)

No dashboard do Supabase (o mesmo projeto do site), va em **SQL Editor** e rode o
conteudo de [`supabase/schema.sql`](supabase/schema.sql). Ele:

- adiciona `tamanho` e `quantidade` na tabela `pecas` existente (nao quebra o site);
- cria as tabelas novas: `clientes`, `pedidos`, `bot_config`, `conversas`, `mensagens`.

Depois pegue em **Settings > API**: a URL do projeto e a chave **service_role**
(nao e a `anon` do site — o bot roda no servidor e precisa da chave secreta).

### 2. Z-API

No painel [app.z-api.io](https://app.z-api.io):

1. Pegue o **ID da instancia** e o **Token da instancia**;
2. Em **Seguranca**, pegue o **Client-Token da conta**;
3. Em **Webhooks** da instancia, configure o webhook **"Ao receber"**
   (on-message-received) apontando pra `https://SEU-DOMINIO/webhook/zapi`
   (voce so vai ter esse dominio depois do deploy — passo 4);
4. Conecte o numero do bot escaneando o QR code.

### 3. Rodar local (teste)

```bash
cd bot
cp .env.example .env   # e preencha as credenciais
npm install
npm start
```

Pra testar o webhook sem WhatsApp conectado:

```bash
curl -X POST http://localhost:3000/webhook/zapi \
  -H 'Content-Type: application/json' \
  -d '{"phone":"5511988887777","senderName":"Teste","text":{"message":"quando e o proximo drop?"}}'
```

(Vai tentar responder via Z-API — se o numero ainda nao estiver conectado, o envio
falha mas voce ve nos logs que a logica funcionou.)

### 4. Deploy (Railway — recomendado)

1. Crie conta em [railway.app](https://railway.app) e conecte este repositorio GitHub;
2. Em **Settings > Root Directory**, aponte pra `bot/`;
3. Em **Variables**, cole todas as variaveis do seu `.env`;
4. O Railway gera um dominio tipo `xxx.up.railway.app` — use ele no webhook da Z-API
   (`https://xxx.up.railway.app/webhook/zapi`).

Custo: plano Hobby ~US$5/mes, roda 24h de boa pra esse volume.

**Alternativa gratis:** Render (render.com, plano free) — mesmo processo, mas o
container **dorme apos 15 min sem trafego** e a primeira mensagem depois disso demora
~30s pra ser respondida. Pra atendimento de cliente isso e ruim, entao vale os US$5
do Railway.

## Configuracao sem codigo (tabela `bot_config`)

Dashboard do Supabase > **Table Editor** > `bot_config`:

| chave                | o que faz                                              |
| -------------------- | ------------------------------------------------------ |
| `proximo_drop`       | data do drop no formato `2026-07-20` (vazio = automatico dia 5/20) |
| `drop_info`          | frase extra que vai junto da data do drop              |
| `frete_capital`      | frete capital SP/RJ (padrao 10)                        |
| `frete_interior`     | frete interior minimo (padrao 12)                      |
| `frete_interior_max` | frete interior maximo (padrao 13)                      |

## Estrutura

```
bot/
├── src/
│   ├── index.js      # servidor Express + webhook da Z-API
│   ├── bot.js        # orquestra: recebe msg, decide o que fazer
│   ├── intents.js    # classificacao por palavra-chave (pt-BR)
│   ├── handlers.js   # estoque, drop, frete, rastreio, escalonamento
│   ├── zapi.js       # envio de mensagens via Z-API
│   ├── supabase.js   # cliente + helpers do banco
│   └── config.js     # leitura/validacao das variaveis de ambiente
├── supabase/
│   └── schema.sql    # rodar no SQL Editor do Supabase
├── .env.example      # modelo das credenciais
└── package.json
```
