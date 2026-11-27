# Validação da reformulação

Verificação local em 27/11/2026. Nenhum teste utilizou credenciais bancárias, contas reais ou o D1 remoto. Fixtures estão nos testes e em bancos descartáveis separados, nunca em migrações ou sementes de produção.

## Evidências

| Camada             | Resultado                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Dependências       | `npm ci` com as versões exatas do `package-lock.json`: React 19.3.0, Vite 8.3.1, Wrangler 4.141.0 e TypeScript 7.0.2           |
| Tipos              | `tsc --noEmit` sem erros                                                                                                       |
| Unidade e migração | 42 testes passaram; inclui 27 regressões anteriores e 15 verificações novas                                                    |
| API + D1 local     | 30 verificações passaram com o Worker real e banco D1 local descartável                                                        |
| Frontend           | Build Vite passou; bundle JS aproximadamente 91 KB gzip                                                                        |
| Worker             | `wrangler deploy --dry-run` passou, sem publicar                                                                               |
| Navegador          | Login, dashboard, cadastro de campanha própria com campos desconhecidos, salvamento e persistência após recarregar confirmados |
| Celular            | Layout e menu conferidos em 390 × 844; página sem transbordamento horizontal; tabelas têm rolagem interna                      |
| Console            | Sem erros ou avisos no fluxo de navegador verificado                                                                           |

O build emite avisos do bundler sobre a diretiva `use client` interna do lucide-react. O projeto é uma aplicação React cliente com Vite; esses avisos não impediram compilação ou execução.

## Cálculos verificados

O cenário de referência permanece exclusivo dos testes, com datas/identificadores de fixture claramente separados dos fatos fornecidos pelo proprietário:

- 1.028 entregas; 218 na BM de R$ 40 e 810 na BM reutilizável de R$ 600.
- R$ 40 + R$ 30 em chips + R$ 16,20 + R$ 4,80 de plataforma = **R$ 91,00** diretamente identificados.
- R$ 475 × 1.028 ÷ 30.000 = **R$ 16,28** de rateio estimado.
- Subtotal parcial de **R$ 107,28**; aproximadamente **R$ 0,1044 por entrega**.
- BM de R$ 40: aproximadamente **R$ 0,1835 por entrega dessa BM**.
- Meta, uso da BM reutilizável, perfis e trabalho continuam pendentes. O teste não lança R$ 600 na campanha e não transforma a declaração de recuperação em custo zero confirmado.

Também foram conferidos: recarga de R$ 200 com consumo de R$ 70 deixando R$ 130; Meta pendente e confirmação posterior; BM distribuída entre campanhas; baixa apenas do residual; chips em estoque e bloqueio de consumo excessivo; rateio incluindo operação própria sem duplicar a DRE; transferências sem receita; operação própria sem retorno inventado; acréscimo de 25% correspondendo a margem de 20% antes de deduções; divisão por zero e arredondamento inteiro.

## Persistência e proteção

- A migração foi aplicada sobre um banco de teste com registros anteriores, saldo inicial, sessão e tabela de documentos. Todos permaneceram.
- API recusou acesso sem sessão, origem ausente, escrita pelas rotas antigas, exclusão de histórico e fechamento com pendências.
- Repetir uma requisição não gravou nova versão. Duas gravações concorrentes produziram um sucesso e um conflito, sem sobrescrever dados.
- Reimportação do mesmo arquivo e reapresentação de um ID bancário não duplicaram linhas. Original e conciliação ficaram persistidos.
- Revisão com mais de um fragmento foi salva, recarregada e recuperada pela auditoria.
- PDF de teste foi anexado, deduplicado e baixado com autenticação.

## Limites do que foi verificado

Não houve publicação, migração remota, teste de credenciais externas nem conferência do conteúdo real do banco de produção. O script de migração exige backup novo e restauração de teste quando for executado no ambiente remoto. O histórico real precisa ser conferido antes de sua conversão, sobretudo recorrências antigas e saldo inicial global.

As conexões automáticas com bancos, Open Finance, Meta e plataformas continuam dependências externas. O funcionamento entregue é manual/importação com persistência. O balanço permanece identificado como posição incompleta.

A recuperação local também foi testada: cópia consistente da base descartável, exportação SQL e restauração em SQLite passaram na integridade, com contagens iguais para dados financeiros, auditoria, revisões, anexos e tabelas antigas.

