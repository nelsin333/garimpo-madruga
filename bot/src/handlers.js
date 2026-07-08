import { config } from './config.js';
import { normalizar } from './intents.js';
import { sendText } from './zapi.js';
import {
  sb,
  getConfig,
  getCliente,
  upsertCliente,
  setConversa,
  ultimasMensagens,
} from './supabase.js';

// ---------------------------------------------------------------
// Estoque / tamanho — consulta a tabela `pecas` do site
// ---------------------------------------------------------------

const PALAVRAS_IGNORADAS = new Set([
  'tem', 'voce', 'vcs', 'vc', 'ainda', 'essa', 'esse', 'uma', 'um', 'de', 'do', 'da',
  'no', 'na', 'em', 'o', 'a', 'que', 'qual', 'quais', 'tamanho', 'tamanhos', 'numeracao',
  'estoque', 'disponivel', 'disponiveis', 'peca', 'pecas', 'pra', 'para', 'mim', 'ai', 'e',
]);

export async function responderEstoque(textoCliente) {
  const termos = normalizar(textoCliente)
    .replace(/[?!.,]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !PALAVRAS_IGNORADAS.has(p));

  let query = sb
    .from('pecas')
    .select('descricao, categoria, tamanho, preco_venda, loja')
    .eq('status', 'disponivel')
    .order('criado_em', { ascending: false })
    .limit(6);

  // busca cada termo em descricao/categoria/tamanho
  for (const termo of termos.slice(0, 4)) {
    query = query.or(
      `descricao.ilike.%${termo}%,categoria.ilike.%${termo}%,tamanho.ilike.%${termo}%`
    );
  }

  const { data: pecas, error } = await query;
  if (error) throw error;

  if (!pecas || pecas.length === 0) {
    if (termos.length > 0) {
      return `Dessa aqui nao tenho disponivel no momento 😕 Mas o proximo drop vem coisa boa. Quer que eu veja outra peca?`;
    }
    return 'No momento to sem pecas disponiveis, mas o proximo drop ta chegando. Manda um "quando e o drop" que te falo a data!';
  }

  const linhas = pecas.map((p) => {
    const partes = [p.descricao || p.categoria || 'Peca'];
    if (p.tamanho) partes.push(`tam ${p.tamanho}`);
    if (p.preco_venda) partes.push(`R$ ${Number(p.preco_venda).toFixed(2).replace('.', ',')}`);
    return `- ${partes.join(' | ')}`;
  });

  const intro = termos.length > 0 ? 'Tenho sim! Olha o que achei aqui:' : 'Olha o que ta disponivel agora:';
  return `${intro}\n\n${linhas.join('\n')}\n\nQuer garantir alguma? Me fala qual.`;
}

// ---------------------------------------------------------------
// Proximo drop — configuravel na tabela bot_config
// ---------------------------------------------------------------

function proximoDropAutomatico() {
  // drops dia 5 e dia 20; calcula no fuso de Sao Paulo
  const agora = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const dia = agora.getDate();
  if (dia < 5) return new Date(ano, mes, 5);
  if (dia < 20) return new Date(ano, mes, 20);
  return new Date(ano, mes + 1, 5);
}

export async function responderDrop() {
  const manual = await getConfig('proximo_drop'); // formato AAAA-MM-DD
  let data;
  if (manual && /^\d{4}-\d{2}-\d{2}$/.test(manual)) {
    const [a, m, d] = manual.split('-').map(Number);
    data = new Date(a, m - 1, d);
  } else {
    data = proximoDropAutomatico();
  }
  const dataFmt = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const extra = await getConfig('drop_info', '');
  return `Proximo drop: ${dataFmt}. ${extra}`.trim();
}

// ---------------------------------------------------------------
// Frete — pergunta a cidade antes de responder
// ---------------------------------------------------------------

const CAPITAIS = ['sao paulo', 'sp capital', 'rio de janeiro', 'rio', 'rj capital'];

export function ehCapital(cidade) {
  const c = normalizar(cidade);
  return CAPITAIS.some((cap) => c === cap || c.startsWith(cap + ' '));
}

export async function responderFrete(whatsapp) {
  const cliente = await getCliente(whatsapp);
  if (cliente?.cidade) {
    return montarRespostaFrete(cliente.cidade, cliente.capital);
  }
  // nao sabe a cidade ainda: pergunta e marca o estado da conversa
  await setConversa(whatsapp, { estado: 'aguardando_cidade' });
  return 'Pra te falar o frete certinho: de qual cidade voce e?';
}

export async function receberCidade(whatsapp, textoCliente) {
  const cidade = textoCliente.replace(/[?!.]/g, '').trim();
  const capital = ehCapital(cidade);
  await upsertCliente(whatsapp, { cidade, capital });
  await setConversa(whatsapp, { estado: 'inicio' });
  return montarRespostaFrete(cidade, capital);
}

async function montarRespostaFrete(cidade, capital) {
  if (capital) {
    const valor = await getConfig('frete_capital', '10');
    return `Pra ${cidade} o frete fica R$${valor}. Tranquilo?`;
  }
  const min = await getConfig('frete_interior', '12');
  const max = await getConfig('frete_interior_max', '13');
  return `Pra ${cidade} o frete fica entre R$${min} e R$${max}, dependendo do peso. Fechou?`;
}

// ---------------------------------------------------------------
// Rastreio — tabela pedidos, busca pelo whatsapp do cliente
// ---------------------------------------------------------------

export async function responderRastreio(whatsapp) {
  const { data: pedidos, error } = await sb
    .from('pedidos')
    .select('descricao, enviado, codigo_rastreio, criado_em')
    .eq('cliente_whatsapp', whatsapp)
    .order('criado_em', { ascending: false })
    .limit(3);
  if (error) throw error;

  if (!pedidos || pedidos.length === 0) {
    return 'Nao achei pedido no seu numero por aqui. Se voce comprou com outro numero me fala qual, ou me conta qual peca foi que eu vejo pra voce.';
  }

  const linhas = pedidos.map((p) => {
    const nome = p.descricao || 'Seu pedido';
    if (p.enviado && p.codigo_rastreio) {
      return `${nome}: ja foi postado! Codigo de rastreio: ${p.codigo_rastreio} (da pra acompanhar no site/app dos Correios)`;
    }
    if (p.enviado) {
      return `${nome}: ja foi postado, o codigo de rastreio sai em breve, te aviso!`;
    }
    return `${nome}: ainda nao foi postado. Assim que sair te mando o codigo!`;
  });

  return linhas.join('\n\n');
}

// ---------------------------------------------------------------
// Escalonamento — avisa o dono no WhatsApp com o historico
// ---------------------------------------------------------------

const MOTIVOS = {
  escalar_devolucao: 'Devolucao / troca / reclamacao',
  escalar_autenticidade: 'Duvida sobre autenticidade',
  escalar_preco: 'Negociacao de preco',
  escalar_outro: 'Pergunta fora do script',
};

export async function escalar(whatsapp, senderName, intent, textoCliente) {
  await setConversa(whatsapp, { estado: 'inicio', escalada: true });

  const historico = await ultimasMensagens(whatsapp, 10);
  const linhas = historico.map((m) => {
    const quem = m.origem === 'bot' ? 'Bot' : 'Cliente';
    return `${quem}: ${m.texto}`;
  });

  const aviso = [
    `🔔 ATENDIMENTO PRECISA DE VOCE`,
    ``,
    `Motivo: ${MOTIVOS[intent] || MOTIVOS.escalar_outro}`,
    `Cliente: ${senderName || 'sem nome'} (${whatsapp})`,
    `Ultima mensagem: "${textoCliente}"`,
    ``,
    `--- Historico ---`,
    ...(linhas.length ? linhas : ['(sem historico anterior)']),
    ``,
    `O bot parou de responder esse cliente. Pra devolver pro bot, me manda: #liberar ${whatsapp}`,
  ].join('\n');

  await sendText(config.ownerPhone, aviso);

  const respostas = {
    escalar_devolucao:
      'Entendi! Troca/devolucao quem resolve e o Madruga mesmo. Ja avisei ele aqui, jaja ele te chama. 🤝',
    escalar_autenticidade:
      'Boa pergunta! Sobre autenticidade o Madruga fala direto com voce. Ja chamei ele, responde rapidinho.',
    escalar_preco:
      'Preco quem bate o martelo e o Madruga. Ja passei seu contato pra ele, segura ai que ele te chama.',
    escalar_outro:
      'Essa eu vou ter que passar pro Madruga. Ja avisei ele, logo logo ele te responde por aqui!',
  };
  return respostas[intent] || respostas.escalar_outro;
}

// ---------------------------------------------------------------
// Comandos do dono (mandados do seu WhatsApp pro numero do bot)
// ---------------------------------------------------------------

export async function comandoDono(texto) {
  const m = texto.trim().match(/^#liberar\s+(\d{8,15})$/i);
  if (m) {
    const numero = m[1];
    await setConversa(numero, { escalada: false, estado: 'inicio' });
    return `Feito! O bot voltou a responder o ${numero}.`;
  }
  return null;
}
