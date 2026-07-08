import express from 'express';
import { config } from './config.js';
import { processarMensagem } from './bot.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

// health check (Railway/Render usam pra saber que o app ta de pe)
app.get('/', (_req, res) => {
  res.json({ ok: true, bot: 'Garimpo do Madruga' });
});

// Webhook da Z-API: configurar em
// painel Z-API > sua instancia > Webhooks > "Ao receber" (on-message-received)
// apontando pra https://SEU-DOMINIO/webhook/zapi
app.post('/webhook/zapi', async (req, res) => {
  // responde 200 na hora pra Z-API nao reenviar; processa em seguida
  res.sendStatus(200);

  const body = req.body || {};
  try {
    await processarMensagem({
      phone: body.phone,
      texto: body.text?.message || body.message || null,
      senderName: body.senderName || body.chatName || null,
      fromMe: Boolean(body.fromMe),
      isGroup: Boolean(body.isGroup),
    });
  } catch (err) {
    console.error('Erro processando mensagem:', err);
  }
});

app.listen(config.port, () => {
  console.log(`Bot do Madruga rodando na porta ${config.port}`);
});
