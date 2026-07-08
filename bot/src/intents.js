// Classificacao de intencao por palavra-chave (sem IA, sem custo).
// Tudo que nao bater em nenhuma regra vira 'escalar_outro'.

export function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const REGRAS = [
  // --- escalonamento (checa primeiro: 'troca' nao pode cair em estoque) ---
  {
    intent: 'escalar_devolucao',
    padroes: [
      /devolu/, /\btroca/, /\btrocar\b/, /reclama/, /defeito/, /veio errad/,
      /veio rasgad/, /veio manchad/, /nao serviu/, /problema com/, /estorno/, /reembolso/,
    ],
  },
  {
    intent: 'escalar_autenticidade',
    padroes: [
      /original/, /autentic/, /\bfalsa\b/, /\bfake\b/, /replica/, /legit/, /\bfals[ao]\b/,
    ],
  },
  {
    intent: 'escalar_preco',
    padroes: [
      /desconto/, /abaixa/, /\bnegocia/, /faz por/, /fecha por/, /baixa o preco/,
      /melhora o preco/, /\bpechinch/, /faz mais barato/, /tem como fazer/,
    ],
  },

  // --- respostas automaticas ---
  {
    intent: 'rastreio',
    padroes: [
      /rastre/, /codigo de envio/, /\bcorreios?\b/, /ja postou/, /ja enviou/, /ja foi enviad/,
      /cade (meu|o) pedido/, /meu pedido/, /status do pedido/, /quando chega/,
    ],
  },
  {
    intent: 'drop',
    padroes: [
      /\bdrops?\b/, /proximo lancamento/, /quando (tem|vai ter|sai|e o) (peca|drop|lancamento)/,
      /pecas? novas?/, /quando posta/,
    ],
  },
  {
    intent: 'frete',
    padroes: [/\bfrete\b/, /valor d[ao] entrega/, /quanto (fica|custa|e) (a entrega|o envio)/, /\benvio\b/],
  },
  {
    intent: 'estoque',
    padroes: [
      /\bestoque\b/, /\bdisponive/, /ainda tem\b/, /\btem (o |a |essa |esse |no |na )?tamanho/,
      /tem numeracao/, /\btamanhos?\b/, /qual tamanho/, /\btem \d{2}\b/,
      /\btem [pmg]{1,2}\b/, /o que (tem|voce tem|vcs? tem)/, /que pecas/, /manda o catalogo/,
    ],
  },
  {
    intent: 'saudacao',
    padroes: [/^(oi+|ola+|opa+|eai+|e ai+|salve|bom dia|boa tarde|boa noite|hey|fala)!*$/],
  },
];

export function classificar(texto) {
  const t = normalizar(texto);
  if (!t) return 'ignorar';
  for (const regra of REGRAS) {
    if (regra.padroes.some((p) => p.test(t))) return regra.intent;
  }
  return 'escalar_outro';
}
