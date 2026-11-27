# BigCash

Controle financeiro em português para uma operação de campanhas de disparo. Interface React + TypeScript na Vercel; API, D1 e autenticação administrativa existentes na Cloudflare.

Endereço de produção: [bigcash-two.vercel.app](https://bigcash-two.vercel.app). Entre com a senha administrativa já existente.

A nova navegação reúne Dashboard, Lançamentos (com campanhas, precificação e recursos expansíveis), Extrato e conciliação, Contas e carteiras, Contas a pagar/receber, Fluxo de caixa, DRE gerencial, Posição patrimonial e Configurações. Não há módulo fiscal ativo.

## Começar localmente

Requer Node.js 24+.

```sh
npm ci
# Crie .dev.vars com APP_PASSWORD="sua-senha-local"
npm run db:local
npm run dev
```

Abra o endereço exibido pelo Wrangler. O banco começa sem lançamentos. Valores de estrutura informados pelo proprietário são referências configuráveis; não criam saldos, pagamentos ou compras fictícias.

- [Manual de operação](docs/OPERACAO.md): cadastros, campanhas, carteiras, rateio, importação, conciliação e conversão conferida do histórico.
- [Implantação e recuperação](docs/IMPLANTACAO.md): backup, restauração de teste, migrações aditivas e publicação.
- [Validação da entrega](docs/VALIDACAO.md): cálculos, testes e limites verificados.

## Regras centrais

Valores monetários ficam em centavos inteiros. Ausência de informação é representada por `null`. Competência, vencimento e liquidação são distintos. Recarga é transferência de saldo; consumo é custo. Aquisição de BM/perfil/chip é registrada uma vez e seu custo é distribuído por política explícita. Limite informado não é vida útil. Uma despesa compartilhada entra uma vez na DRE; o rateio só a distribui.

Operação concluída pode continuar com financeiro em apuração. A cobrança tardia da Meta ajusta a mesma linha e preserva auditoria. Campanha própria sem receita confiável não apresenta retorno inventado. Simulação incompleta não recomenda preço definitivo. Reserva faz parte do saldo e não gera recomendações de retirada.

## Histórico e segurança

As migrações 0007 e 0008 são aditivas: registros anteriores e sessões permanecem. O histórico antigo está em Configurações para conferência e conversão sem duplicação. Ele não é somado automaticamente ao novo modelo, pois o modelo anterior não distinguia as datas financeiras. Até converter, os relatórios permanecem incompletos.

A API valida os vínculos e cálculos, preserva os originais bancários, usa controle otimista de versão, idempotência e auditoria transacional. Comprovantes ficam atrás do login. O aplicativo continua sendo de administrador único. Credenciais ficam no Worker; não há autenticação bancária no navegador.

```sh
npm test
npm run build
# Com servidor local em 127.0.0.1:8787 e banco de teste novo:
npm run test:api
```

Testes da API usam somente a senha exclusiva `bigcash-local-test-only` em `.dev.vars` de uma base descartável. Não execute fixtures em banco de uso real.

## Produção

Não aplique migrações sem backup verificado. O comando abaixo exporta o D1, registra referência Time Travel e testa a restauração antes de migrar:

```sh
npm run db:remote -- --backup CAMINHO_PRIVADO_FORA_DO_REPOSITORIO/backup.sql
npm run deploy
```

Preserve a senha e os secrets existentes. Leia o procedimento completo antes de publicar. As APIs de bancos/Open Finance, Meta e plataforma de disparo não estão conectadas: dependem dos fornecedores, credenciais e eventual contratação. OFX/CSV e o fluxo manual estão implementados. Web Push existente depende de VAPID configurado; não há mensagens automatizadas a clientes, pagamentos ou saques.
