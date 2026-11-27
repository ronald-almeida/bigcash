# Operação financeira e entrada em uso

A versão mantém React, Cloudflare Workers, D1, sessão HttpOnly, senha administrativa no servidor e PWA. É um workspace administrativo único, como o original; não cria contas individuais ou permissões fictícias.

## Primeiro acesso

1. Instale Node.js 24 ou superior e execute `npm ci`.
2. Crie `.dev.vars`, ignorado pelo Git, com `APP_PASSWORD="sua-senha-local"`. Nunca copie credenciais de produção para esse arquivo de teste.
3. Execute `npm run db:local` e `npm run dev`.
4. Abra o endereço indicado pelo Wrangler e entre com a senha local.

O banco local começa sem lançamentos. Os valores de referência fornecidos pelo proprietário ficam em **Configurações**; não são compras, saldos ou recorrências lançadas automaticamente.

## Sequência de uso

- **Contas e carteiras:** cadastre titularidade, natureza do saldo, origem e data da última conferência. Saldo inicial exige valor e data juntos; sem isso, aparece como não informado. Abertura representa o saldo anterior aos movimentos dessa data. A reserva é uma parte identificada do saldo bancário.
- **Configurações:** confira as referências de R$ 112, R$ 66 e R$ 297; o orçamento inicial totaliza R$ 475 e usa 30 mil mensagens. Confirme periodicidade e vigência. A opção “Gerar mês” cria um título pendente para o mês escolhido, uma única vez. Não presume pagamento nem gera toda a série futura.
- **Lançamentos:** cadastre receitas, despesas e aquisições. Informe competência e vencimento. Registre a liquidação pela ação Pagar/Receber, com conta, valor e data reais. Liquidações parciais são permitidas; estornos referenciam o original e reabrem o título. Corrigir um valor já liquidado exige estornar primeiro.
- **Campanhas, dentro de Lançamentos:** informe cliente ou operação própria, datas, situação operacional e financeira. Quantidades desconhecidas ficam vazias. Expanda a campanha para custos, recursos, preço e comprovantes.
- **Cadastros auxiliares, dentro de Lançamentos:** cadastre cada BM, perfil ou lote de chips. Aquisição total, quantidade, limite informado e política de distribuição são independentes. Para pagar a aquisição, vincule um título de ativo já cadastrado. O cadastro isolado de recurso não inventa um pagamento.
- **Custos:** registre componente, valor e situação. Custos de BM/perfil/chip confirmados vinculam recurso; o total distribuído nunca ultrapassa a aquisição. Consumo de plataforma/Meta pode vincular carteira. Outros custos confirmados vinculam despesa existente ou geram um título a pagar. Use a base específica de cada fornecedor em “Base de cobrança”.
- **Meta pendente:** o operacional pode ficar concluído com financeiro em apuração. Ajuste a mesma linha quando chegar a cobrança; o histórico conserva o valor anterior. Fechamento exige componentes confirmados ou justificativa explícita de não aplicabilidade. Campanhas de clientes também precisam de receita atribuível.
- **Rateio:** “Estimar estrutura” registra apenas orçamento. “Fechar rateio” distribui uma despesa compartilhada entre todas as campanhas do período, incluindo próprias, por entregues, enviadas ou minutos de trabalho. Quantidades ausentes impedem o fechamento. O rateio manual documentado está disponível na inclusão de custo compartilhado. O orçamento anterior e a diferença ficam visíveis ao confirmar.
- **Encerramento de BM:** trate o saldo ainda não distribuído. Em uso exclusivo, atribua o restante à campanha. Em perda sem campanha, registre baixa residual com data e motivo. Custos anteriores nunca são lançados novamente.
- **Precificação:** escolha preço por mensagem enviada/entregue, preço fechado, consumo mais operação ou acréscimo sobre custo. A simulação mostra deduções, resultado estimado e margem sobre receita. Custos ausentes mantêm “simulação incompleta”; R$ 0,30 é apenas referência comercial configurável.
- **Receita entre BMs:** após cadastrar receita confiável, use “Distribuir receita entre BMs”. Entregas conhecidas ou partes iguais precisam de justificativa. A soma não ultrapassa a receita; a distribuição não cria novas receitas. Declaração manual de investimento recuperado continua identificada como declaração.
- **Comprovantes:** PDF, PNG e JPEG de até 1,9 MB ficam no D1, com acesso autenticado, validação de assinatura e deduplicação por conteúdo/campanha. Arquivos são baixados como anexos.

## Extrato e conciliação

Importe OFX ou CSV em BRL, até 2 MB. CSV usa `data,valor,descricao,id` ou as mesmas colunas separadas por ponto e vírgula. `id` é opcional. Datas aceitas: `AAAA-MM-DD` ou `DD/MM/AAAA`. Saídas são negativas. Exemplo exclusivamente de formato:

```csv
data;valor;descricao;id
2026-11-10;-200,00;Transferência para carteira;identificador-do-banco
```

O arquivo e cada linha original são preservados. Reimportação do mesmo arquivo não gera novas linhas. FITID/ID do banco identifica movimentos; sem ID, usa-se data, valor, descrição e posição entre ocorrências idênticas. Extratos sobrepostos sem IDs podem ser ambíguos: confira o original antes de concluir a conciliação. Não há promessa de identificação perfeita sem identificadores fornecidos pelo banco.

Importar não movimenta o caixa nem cria despesa. Concilie com liquidações existentes. Pode dividir uma linha entre movimentos e conciliar parcialmente. Valores, sinal, conta e total já vinculado são verificados. Registre tarifas em despesa própria. Transferências têm dois lados, mas não são faturamento. Estorno de pagamento reabre o título; uma devolução que altere a receita ou despesa também exige ajuste da competência correspondente.

## Relatórios e limites de interpretação

O dashboard separa bancos, plataformas, bloqueados e restritos, além de recebimentos e pagamentos pela liquidação. Filtros de cliente/operação não repartem saldos bancários. A visão de uma conta inclui campanhas a ela associadas; não representa atribuição automática de cada custo àquela conta.

A DRE utiliza competência e custos confirmados. Despesas vinculadas a custos e rateios não são somados de novo. No recorte de campanha/cliente, a parcela compartilhada atribuída participa do resultado gerencial. Em operação própria sem receita atribuível, o retorno é não apurado. A posição patrimonial é explicitamente incompleta e não substitui balanço contábil.

O caixa realizado inclui recebimentos/pagamentos externos, excluindo transferências próprias e recargas consolidadas. O consumo de crédito altera a carteira e a DRE; não é novo pagamento bancário. Previsões usam títulos ainda abertos. Não há sugestão automática de retirada ou investimento.

## Dados anteriores

As migrações 0007 e 0008 apenas acrescentam tabelas. `entries`, `settings`, metas, sessões e registros existentes permanecem. Rotas antigas de alteração são bloqueadas para evitar gravação simultânea em dois modelos.

**Configurações → Histórico anterior** exibe ocorrências no período selecionado e permite conferir/convertê-las em títulos, com chave que impede a conversão duplicada. A conversão é deliberadamente conferida: o modelo antigo não distinguia competência, vencimento e liquidação e replicava o estado “pago” da recorrência. O saldo inicial global antigo também exige identificação de conta e data. Até essa conferência, os novos relatórios não representam todo o histórico.

Os cálculos antigos permanecem em módulos isolados para interpretar o legado e executar regressões. O antigo dashboard, a precificação baseada em capacidade de BM e as páginas redundantes não fazem parte da nova navegação. Não há módulo fiscal ativo.

## Persistência, auditoria e capacidade

Cada salvamento usa versão esperada e identificador de requisição. Edições concorrentes geram conflito em vez de sobrescrever silenciosamente. A atualização, seus fragmentos e o registro de auditoria são gravados em uma transação D1. Revisões anteriores são imutáveis. O histórico mostra motivo, momento e ator administrativo; `GET /api/operations/audit/{versao}` disponibiliza o estado daquela revisão.

O workspace tem limite explícito de 12 MB por estado, com fragmentos de até 15 mil caracteres para respeitar limites do D1; ao atingir o limite, novas gravações falham sem descartar dados. Este desenho atende uma operação pequena de administrador único. Crescimento além desse volume exige paginação e persistência por entidade, sem apagar o histórico. Comprovantes ficam em tabela separada. A exportação JSON é para consulta e inclui referências às revisões/anexos; backup completo exige exportação D1.

## Integrações

O repositório contém Cloudflare D1 e push Web Push. Push depende de secrets VAPID existentes; mantém identificação diária para evitar reprocessamento de notificações. Nenhuma mensagem é enviada a clientes.

Não foram encontradas conexões oficiais ativas de bancos, Open Finance, Meta ou plataforma de disparo. Nomes dos bancos/fornecedores e credenciais não foram fornecidos. O fluxo manual/importação funciona sem essas dependências. Uma conexão futura exigirá API oficial compatível, autenticação no servidor, escopos e eventual contratação. Esta entrega não declara sincronização externa ativa.

