# SKISEASON 16*29 - README

Bem-vindo ao repositório da **SKISEASON** (antiga Spike Season), uma loja premium de óculos góticos/minimalistas.

## Funcionalidades
- **Checkout Pro (Mercado Pago)**: Integração via frontend para pagamentos seguros com Pix e Cartão.
- **Cálculo de CEP**: Detecção automática de frete por estado.
- **Cupons**: Sistema de descontos dinâmicos (`SKI15`, `SKI10`).
- **Design Premium**: Responsivo, animações suaves e modo escuro.

## Testes para o Desenvolvedor
Para realizar um teste de ponta a ponta sem gastar o valor real do produto:
1. Adicione um óculos ao carrinho.
2. No checkout, use o cupom: **`DEV5`**.
3. O valor total cairá para aproximadamente **R$ 5,00**.
4. Realize o pagamento e verifique a confirmação.

## Segurança
- As chaves do Mercado Pago em `config.js` estão ofuscadas em Base64 para evitar extração simples por bots no GitHub.
- **Dica**: Para produção em larga escala, recomenda-se o uso de um servidor backend (exemplo disponível na pasta `backup/server.js.bkp`).

## Suporte
Qualquer dúvida, entre em contato via: `mherarco2030@gmail.com`