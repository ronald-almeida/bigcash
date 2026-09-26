# BigCash

Sistema financeiro em português para uma empresa, com interface responsiva em verde, React + TypeScript, API Cloudflare Workers e banco Cloudflare D1. Sem dados fictícios em produção.

## Funcionalidades

- Dashboard com filtros de período, receitas recebidas, despesas pagas, resultado, caixa acumulado, fluxo financeiro e distribuição por categoria.
- Gastos diários, ferramentas mensais, despesas fixas e pró-labore.
- Farm de BM: composição de custo com perfil, BM, Instagram, SMS e itens variáveis.
- Receitas brutas com taxa opcional em reais ou porcentagem.
- Taxas adicionais vinculadas a receitas cadastradas, classificadas como serviço ou imposto.
- Saldo inicial configurável; pendências separadas do caixa disponível.
- Cadastro, edição, exclusão confirmada, busca, paginação e exportação CSV.
- Marcação de gastos para revisão e insights sobre compromissos mensais e resultado negativo.
- Acesso administrativo protegido por senha, sessão HttpOnly de 24h, verificação de origem e limite de tentativas.

## Regras de cálculo

Valores monetários são armazenados em centavos inteiros. Percentuais são armazenados em centésimos de porcentagem. O arredondamento acontece por taxa.

O caixa é o saldo inicial mais todas as receitas recebidas, menos todas as despesas pagas, com data até hoje (America/Bahia). Os filtros do dashboard não alteram esse indicador acumulado; os outros indicadores obedecem ao período escolhido. Pendências não movimentam caixa.

As taxas embutidas na receita são geradas uma vez no dashboard e no caixa. Taxas cadastradas separadamente são despesas adicionais: não cadastre duas vezes a mesma cobrança.

Ferramentas, despesas fixas e pró-labore podem repetir mensalmente. A recorrência inclui a data final; dias 29–31 são ajustados para o último dia dos meses menores. Valor e situação se aplicam a todas as ocorrências do cadastro. Para controle independente de pagamentos mensais, cadastre lançamentos únicos. Editar ou excluir uma série afeta todo o histórico calculado dessa série.

Insights apontam oportunidades para análise do usuário; não determinam automaticamente que um gasto é desnecessário. Não há integração bancária nem cálculo legal de alíquotas.

## Desenvolvimento

Requer Node.js 22.13+.

```sh
npm ci
# Crie .dev.vars com APP_PASSWORD="uma-senha-local"
npm run db:local
npm run dev
```

Abra o endereço exibido pelo Wrangler. `.dev.vars` é ignorado pelo Git e não deve conter credenciais de produção.

```sh
npm test
npm run build
```

Os testes cobrem taxas fixas e percentuais, arredondamento, receita líquida, pendências, custos de BM, limites de datas, recorrências e validação. O workflow do GitHub executa testes e build.

## Publicação no Cloudflare

Documentação: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) e [D1](https://developers.cloudflare.com/d1/).

```sh
npx wrangler login
npx wrangler d1 create bigcash-db
```

Substitua `local-bigcash` no `database_id` de `wrangler.jsonc` pelo ID retornado. Em seguida:

```sh
npm run db:remote
npm run deploy
npx wrangler secret put APP_PASSWORD
```

Use uma senha forte e exclusiva. Até a senha ser configurada a API recusa qualquer acesso. O Wrangler exibe o endereço `workers.dev` ao publicar. O banco de produção inicia vazio. A senha local de teste não é publicada.

O sistema é um workspace de administrador único. Não possui isolamento entre empresas, contas individuais, recuperação de senha por e-mail ou anexos de comprovantes. Para trocar a senha use `wrangler secret put APP_PASSWORD`; revogue também as sessões existentes com `DELETE FROM sessions` no D1, pois sessões válidas permanecem ativas até sua expiração.

Backups podem ser exportados com `wrangler d1 export bigcash-db --remote --output backup.sql`; armazene-os fora do repositório público. A exportação CSV é destinada à consulta, não substitui um backup do banco.
