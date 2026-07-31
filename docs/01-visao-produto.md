# 01 — Visão do Produto

## A tese

O mercado brasileiro de revenda de moda (streetwear, vintage, sneakers, luxo acessível) explodiu — mas opera no escuro:

- **Compra às cegas.** Quem compra uma Supreme Box Logo, uma Stone Island ou um Jordan 1 no Enjoei, na OLX ou num grupo de WhatsApp não tem como saber se é original. O "legit check" hoje é mandar foto para um amigo entendido ou postar em grupo do Facebook.
- **Venda travada.** Quem vende peça boa não consegue provar autenticidade e perde valor: peças originais são vendidas com desconto de "risco de fake".
- **Réplicas cada vez melhores.** As "1:1" chinesas enganam olho destreinado. O custo de errar é alto (peças de R$ 800 a R$ 15.000).
- **Soluções internacionais não servem.** Legit App e CheckCheck não falam português, não conhecem o mercado de brechó brasileiro, não aceitam Pix, cobram em dólar e demoram. StockX/GOAT não operam logística no Brasil e o imposto de importação mata o preço.

**Garimpo Madruga** resolve isso com uma cadeia de valor completa:

```
AUTENTICAR  →  VALORIZAR  →  VENDER  →  RASTREAR
(legit check    (selo + preço    (anúncio em     (histórico da peça
 por IA +        sugerido por     1 clique,       via QR, revenda
 revisores)      IA)              multi-canal)    com selo mantido)
```

## Por que agora

1. **IA multimodal ficou boa e barata o suficiente** para análise forense de imagem (tipografia de etiqueta, densidade de costura, comparação com referência) a custo de centavos por check.
2. **O mercado secundário brasileiro amadureceu**: Enjoei abriu capital, Droper validou sneakers, brechós viraram lifestyle, "garimpo" virou verbo de status.
3. **Pix + Melhor Envio + Mercado Pago** tornaram viável montar marketplace com custódia de pagamento sem banco próprio.
4. **Nenhum player nacional combina autenticação + marketplace.** Quem autenticar primeiro em escala vira o padrão — efeito de rede duplo (dados de peças + liquidez de mercado).

## O que o produto É

- Um **motor de autenticação probabilística** com relatório detalhado (score, pontos positivos, pontos suspeitos, comparações lado a lado, nível de risco) e revisão humana para casos incertos.
- Um **banco de conhecimento vivo** de peças autênticas (etiquetas, seriais, medidas, temporadas, fontes, costuras) que melhora a cada check.
- Um **marketplace com selo**: peça verificada vale mais, vende mais rápido, e o selo acompanha a peça na revenda.
- Uma **comunidade de garimpeiros**: feed de fits, coleções, achados, trocas.

## O que o produto NÃO é

- Não é um "detector de fake" com resposta binária. **Nunca prometemos certeza absoluta** — vendemos redução de risco com transparência.
- Não é um clone de StockX com custódia física obrigatória no MVP (custódia vem na V2, como serviço premium).
- Não é ferramenta de scraping/automação sobre marketplaces de terceiros.

## Cliente e personas

| Persona                                                 | Dor                                      | O que usamos para ganhar                                      |
| ------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| **O Garimpeiro** (18–30, compra em brechó/bazar/online) | Medo de pagar caro em fake               | Legit check no celular em minutos, preço de mercado na hora   |
| **O Revendedor** (reseller de sneaker/street)           | Provar autenticidade e precificar rápido | Selo + anúncio em 1 clique + export multi-canal               |
| **O Colecionador** (25–45, alta renda)                  | Documentar e valorizar coleção           | Vault digital, histórico da peça, estatísticas de valorização |
| **O Comprador cauteloso**                               | Não entende de peça, quer segurança      | Comprar só peça com selo; escrow; devolução se laudo divergir |

## Posicionamento

> "**Garimpo Madruga: se tem selo, é real.**"

- Contra Legit App/CheckCheck: **em português, com Pix, mais rápido, com marketplace acoplado** (eles param no laudo; nós monetizamos a venda).
- Contra Enjoei/OLX: **camada de confiança** que eles não têm e não conseguem construir rápido (exige banco de dados de referência + operação de revisores).
- Contra Droper: **cobertura além de sneakers** (roupas, bonés, vintage, acessórios) + IA proprietária em vez de só revisão manual.

## Métricas norte (North Star + guardrails)

- **North Star: peças verificadas/mês** (proxy de confiança gerada e de dado novo no banco).
- GMV do marketplace e taxa de conversão anúncio→venda.
- Precisão da IA: taxa de falso positivo em auditoria (< 1% em vereditos "baixo risco"), % de casos escalados a humano (meta: cair de ~40% para <15% conforme o banco cresce).
- Tempo médio de veredito (meta MVP: < 30 min com humano; < 2 min só IA em alta confiança).
- NPS de compradores de peça com selo.

## Princípios de produto

1. **Honestidade estatística é a marca.** Score calibrado, linguagem de probabilidade, disclaimers claros. Um único escândalo de "selo em fake" destrói o negócio — por isso revisão humana obrigatória em faixas de incerteza e seguro/garantia de recompra na V1.
2. **O dado é o produto.** Cada foto enviada (com consentimento) alimenta o banco de referência. Preço por check pode ser subsidiado porque o dado vale mais que a taxa.
3. **Velocidade de veredito é feature.** O concorrente é "mandar foto pro amigo" — precisamos ser mais rápidos e mais confiáveis que o amigo.
4. **Vender tem que ser burro de tão fácil.** A IA já extraiu marca, modelo, ano, cor, medidas: anúncio nasce pronto.
