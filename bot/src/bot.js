import { config } from './config.js';
import { classificar } from './intents.js';
import { sendText } from './zapi.js';
import { getConversa, salvarMensagem, upsertCliente } from './supabase.js';
import {
  responderEstoque,
  responderDrop,
  responderFrete,
  receberCidade,
  responderRastreio,
  escalar,
  comandoDono,
} from './handlers.js';

const SAUDACAO =
  'Opa! Aqui e o bot do Garimpo do Madruga 👊\n' +
  'Posso te ajudar com:\n' +
  '- pecas e tamanhos disponiveis\n' +
  '- data do proximo drop\n' +
  '- valor do frete\n' +
  '- rastreio do seu pedido\n' +
  'Manda ai o que voce precisa!';

// Processa uma mensagem recebida pelo webhook da Z-API
export async function processarMensagem({ phone, texto, senderName, fromMe, isGroup }) {
  if (fromMe || !texto) return;
  if (isGroup && !config.replyInGroups) return;

  const whatsapp = String(phone).replace(/\D/g, '');

  // mensagem do dono pro numero do bot: checa comandos (#liberar)
  if (whatsapp === config.ownerPhone) {
    const resposta = await comandoDono(texto);
    if (resposta) await sendText(whatsapp, resposta);
    return;
  }

  await salvarMensagem(whatsapp, 'cliente', texto);
  await upsertCliente(whatsapp, senderName ? { nome: senderName } : {});

  const conversa = await getConversa(whatsapp);

  // conversa escalada = humano assumiu, bot so registra e fica quieto
  if (conversa.escalada) return;

  let resposta;

  // fluxo em andamento: bot perguntou a cidade pro frete
  if (conversa.estado === 'aguardando_cidade') {
    resposta = await receberCidade(whatsapp, texto);
  } else {
    const intent = classificar(texto);
    switch (intent) {
      case 'ignorar':
        return;
      case 'saudacao':
        resposta = SAUDACAO;
        break;
      case 'estoque':
        resposta = await responderEstoque(texto);
        break;
      case 'drop':
        resposta = await responderDrop();
        break;
      case 'frete':
        resposta = await responderFrete(whatsapp);
        break;
      case 'rastreio':
        resposta = await responderRastreio(whatsapp);
        break;
      default:
        // escalar_devolucao | escalar_autenticidade | escalar_preco | escalar_outro
        resposta = await escalar(whatsapp, senderName, intent, texto);
    }
  }

  if (resposta) {
    await salvarMensagem(whatsapp, 'bot', resposta);
    await sendText(whatsapp, resposta);
  }
}
