import {
  type State,
  type Account,
  type Campaign,
  type Cost,
  type Resource,
  type Entry,
  type Settlement,
  type Source,
  type PriceInput,
  emptyPrice,
  sourceNames,
  outstanding,
  assigned,
  stock,
  budgetStructure,
  splitCents,
  inPeriod,
  mulDiv,
  campaignTotals,
} from "./operations";
import { type Editor, type Field, options, select, currency } from "./ui";
export const uid = () => crypto.randomUUID();
export const operational = {
  planned: "Planejada",
  running: "Em execução",
  completed: "Concluída",
  cancelled: "Cancelada",
};
export const financial = {
  estimated: "Estimada",
  review: "Em apuração",
  closed: "Fechada",
};
export type Actions = ReturnType<typeof operationActions>;
export function operationActions(
  s: State,
  save: (state: State, reason: string) => Promise<void>,
  open: (e: Editor) => void,
  from: string,
  to: string,
) {
  const patch = <
    K extends
      | "accounts"
      | "campaigns"
      | "resources"
      | "entries"
      | "settlements"
      | "costs",
  >(
    key: K,
    item: State[K][number],
  ) =>
    ({
      ...s,
      [key]: s[key].some((x) => x.id === item.id)
        ? s[key].map((x) => (x.id === item.id ? item : x))
        : [...s[key], item],
    }) as State;
  function editAccount(a?: Account) {
    open({
      title: a ? "Editar conta" : "Nova conta ou carteira",
      description:
        "Sem saldo inicial e data confirmados, o saldo permanece não informado. A reserva faz parte do saldo.",
      fields: [
        {
          name: "name",
          label: "Identificação",
          value: a?.name,
          required: true,
        },
        {
          name: "owner",
          label: "Titularidade",
          value: a?.owner,
          required: true,
        },
        select("kind", "Tipo", a?.kind ?? "bank", {
          bank: "Conta bancária",
          wallet: "Carteira de plataforma",
        }),
        select(
          "availability",
          "Disponibilidade",
          a?.availability ?? "available",
          {
            available: "Disponível",
            blocked: "Bloqueado",
            restricted: "Restrito ao consumo",
          },
        ),
        {
          name: "opening",
          label: "Saldo de abertura (R$)",
          type: "money",
          value: a?.opening,
          min: -1000000000,
        },
        {
          name: "openingDate",
          label: "Data do saldo de abertura",
          type: "date",
          value: a?.openingDate,
        },
        {
          name: "source",
          label: "Origem dos dados",
          value: a?.source ?? "Cadastro manual",
          required: true,
        },
        {
          name: "updatedAt",
          label: "Última conferência",
          type: "date",
          value: a?.updatedAt,
        },
        {
          name: "reserve",
          label: "Reserva dentro do saldo (R$)",
          type: "money",
          value: a?.reserve ?? 0,
        },
      ],
      save: async (v) =>
        save(
          patch("accounts", {
            ...v,
            id: a?.id ?? uid(),
            openingDate: v.openingDate || null,
            updatedAt: v.updatedAt || null,
            reserve: v.reserve ?? 0,
          } as Account),
          "Conta: " + v.name,
        ),
    });
  }
  function editCampaign(c?: Campaign) {
    open({
      title: c ? "Editar campanha de disparo" : "Nova campanha de disparo",
      description:
        "Deixe em branco os números desconhecidos. Enviadas, entregues e cobradas são bases distintas. Situação financeira é independente do envio.",
      fields: [
        {
          name: "name",
          label: "Nome da campanha",
          value: c?.name,
          required: true,
        },
        { name: "client", label: "Cliente", value: c?.client },
        {
          name: "own",
          label: "Operação própria",
          type: "checkbox",
          value: c?.own ?? false,
        },
        {
          name: "planned",
          label: "Data prevista",
          type: "date",
          value: c?.planned,
        },
        {
          name: "performed",
          label: "Data realizada",
          type: "date",
          value: c?.performed,
        },
        select(
          "operational",
          "Situação operacional",
          c?.operational ?? "planned",
          operational,
        ),
        select(
          "financial",
          "Situação financeira",
          c?.financial ?? "estimated",
          financial,
        ),
        ...(
          [
            "expected",
            "sent",
            "delivered",
            "failed",
            "billed",
            "hours",
          ] as const
        ).map((name, i): Field => ({
          name,
          label: [
            "Quantidade prevista",
            "Mensagens enviadas",
            "Mensagens entregues",
            "Falhas",
            "Mensagens cobradas (referência)",
            "Tempo de trabalho (minutos)",
          ][i],
          type: "number",
          value: c?.[name],
        })),
        {
          name: "notes",
          label: "Observações",
          type: "textarea",
          value: c?.notes,
        },
      ],
      save: async (v) =>
        save(
          patch("campaigns", {
            ...v,
            id: c?.id ?? uid(),
            planned: v.planned || null,
            performed: v.performed || null,
            notApplicable: c?.notApplicable ?? {},
            pricing: c?.pricing ?? emptyPrice(),
          } as Campaign),
          "Campanha: " + v.name,
        ),
    });
  }
  function editEntry(e?: Entry, c?: Campaign) {
    open({
      title: e?.id ? "Editar lançamento" : "Novo lançamento",
      description:
        "Receita/despesa pertence à competência. Liquidação é registrada separadamente. Aquisição de recurso vai para ativo e será distribuída no uso.",
      fields: [
        { name: "name", label: "Descrição", value: e?.name, required: true },
        select("kind", "Tipo", e?.kind ?? "expense", {
          income: "Receita",
          expense: "Despesa",
          asset: "Aquisição de ativo/recurso",
        }),
        {
          name: "amount",
          label: "Valor (R$)",
          type: "money",
          value: e?.amount,
          required: true,
        },
        {
          name: "competence",
          label: "Competência",
          type: "date",
          value: e?.competence,
          required: true,
        },
        {
          name: "due",
          label: "Vencimento",
          type: "date",
          value: e?.due,
          required: true,
        },
        {
          name: "campaignId",
          label: "Campanha",
          type: "select",
          value: e?.campaignId ?? c?.id ?? "",
          options: options(s.campaigns),
        },
        {
          name: "client",
          label: "Cliente/fornecedor",
          value: e?.client ?? c?.client ?? "",
        },
        { name: "category", label: "Categoria", value: e?.category ?? "Geral" },
        {
          name: "shared",
          label: "Despesa compartilhada para ratear",
          type: "checkbox",
          value: e?.shared ?? false,
        },
        {
          name: "notes",
          label: "Observações",
          type: "textarea",
          value: e?.notes,
        },
      ],
      save: async (v) =>
        save(
          patch("entries", {
            ...v,
            id: e?.id || uid(),
            legacyKey: e?.legacyKey ?? "",
          } as Entry),
          "Lançamento: " + v.name,
        ),
    });
  }
  function settle(
    e?: Entry,
    kind: Settlement["kind"] = e?.kind === "income" ? "receipt" : "payment",
    original?: Settlement,
  ) {
    open({
      title:
        kind === "refund"
          ? "Estornar movimentação"
          : kind === "topup"
            ? "Recarga de carteira"
            : kind === "transfer"
              ? "Transferência entre contas"
              : kind === "receipt"
                ? "Registrar recebimento"
                : "Registrar pagamento",
      description:
        kind === "refund"
          ? "O estorno preserva o original e reabre o título. Não altera a receita/despesa por competência."
          : "Informe a data real. Transferências e recargas não geram faturamento nem despesa.",
      fields: [
        {
          name: "amount",
          label: "Valor movimentado (R$)",
          type: "money",
          value: original?.amount ?? (e ? outstanding(s, e) : null),
          required: true,
        },
        {
          name: "date",
          label: "Data da liquidação/movimento",
          type: "date",
          required: true,
        },
        {
          name: "accountId",
          label: "Conta bancária",
          type: "select",
          value: original?.accountId ?? "",
          options: options(
            s.accounts.filter((a) => a.kind === "bank"),
            "Selecione",
          ),
          required: true,
        },
        ...(["transfer", "topup"].includes(kind)
          ? [
              {
                name: "targetId",
                label: "Conta/carteira de destino",
                type: "select",
                options: options(
                  s.accounts.filter(
                    (a) => kind !== "topup" || a.kind === "wallet",
                  ),
                  "Selecione",
                ),
                required: true,
              } as Field,
            ]
          : []),
        { name: "notes", label: "Descrição/documentação", type: "textarea" },
      ],
      save: async (v) =>
        save(
          patch("settlements", {
            ...v,
            id: uid(),
            kind,
            targetId: v.targetId ?? "",
            entryId: e?.id ?? original?.entryId ?? "",
            reversalOf: original?.id ?? "",
          } as Settlement),
          "Movimentação: " + kind,
        ),
    });
  }
  function editResource(r?: Resource) {
    open({
      title: r ? "Editar recurso" : "Cadastrar BM, perfil ou lote de chips",
      description:
        "Limite não define vida útil. Vincule a aquisição para controlar pagamento; evite cadastrar o investimento duas vezes.",
      fields: [
        {
          name: "name",
          label: "Identificação",
          value: r?.name,
          required: true,
        },
        select("kind", "Recurso", r?.kind ?? "bm", {
          bm: "BM",
          profile: "Perfil reutilizável",
          chip: "Lote de chips",
        }),
        {
          name: "amount",
          label: "Aquisição total (R$)",
          type: "money",
          value: r?.amount,
        },
        {
          name: "acquired",
          label: "Data de aquisição",
          type: "date",
          value: r?.acquired,
        },
        {
          name: "quantity",
          label: "Quantidade adquirida",
          type: "number",
          value: r?.quantity ?? 1,
          required: true,
        },
        {
          name: "limit",
          label: "Limite informado (não é vida útil)",
          type: "number",
          value: r?.limit,
        },
        select("status", "Situação", r?.status ?? "available", {
          available: "Disponível",
          in_use: "Em uso",
          ...(r?.status === "closed" ? { closed: "Encerrada" } : {}),
        }),
        {
          name: "entryId",
          label: "Lançamento de aquisição",
          type: "select",
          value: r?.entryId ?? "",
          options: options(s.entries.filter((e) => e.kind === "asset")),
        },
        {
          name: "policy",
          label: "Política de distribuição do custo",
          type: "textarea",
          value: r?.policy,
          hint: "Ex.: uso exclusivo; distribuição manual com base no histórico.",
        },
        {
          name: "recoveredStatement",
          label: "Declaração manual de recuperação do investimento",
          value: r?.recoveredStatement,
          hint: "Não será tratada como retorno comprovado.",
        },
      ],
      save: async (v) =>
        save(
          patch("resources", {
            ...v,
            id: r?.id ?? uid(),
            acquired: v.acquired || null,
            ended: r?.ended ?? null,
            reason: r?.reason ?? "",
          } as Resource),
          "Recurso: " + v.name,
        ),
    });
  }
  function closeResource(r: Resource) {
    const remaining = r.amount === null ? null : r.amount - assigned(s, r.id);
    open({
      title: "Encerrar " + r.name,
      description:
        "Custo ainda não atribuído: " +
        currency(remaining) +
        ". Para uso exclusivo, atribua integralmente à campanha. Baixa por perda entra uma vez na DRE.",
      fields: [
        {
          name: "date",
          label: "Data do encerramento",
          type: "date",
          required: true,
        },
        {
          name: "reason",
          label: "Motivo/documentação",
          type: "textarea",
          required: true,
        },
        {
          name: "campaignId",
          label: "Destino do saldo residual",
          type: "select",
          options: options(s.campaigns, "Baixa por perda sem campanha"),
        },
      ],
      save: async (v) => {
        if (remaining === null)
          throw Error("Informe o valor de aquisição antes de encerrar.");
        const next = patch("resources", {
          ...r,
          status: "closed",
          ended: String(v.date),
          reason: String(v.reason),
        });
        if (remaining > 0) {
          if (v.campaignId)
            next.costs = [
              ...s.costs,
              {
                id: uid(),
                campaignId: String(v.campaignId),
                source: r.kind,
                status: "confirmed",
                amount: remaining,
                date: String(v.date),
                resourceId: r.id,
                walletId: "",
                entryId: "",
                quantity: r.kind === "chip" ? stock(s, r) : null,
                delivered: null,
                basis: "Saldo residual no encerramento: " + v.reason,
                notes: "",
              },
            ];
          else
            next.writeOffs = [
              ...s.writeOffs,
              {
                id: uid(),
                resourceId: r.id,
                amount: remaining,
                date: String(v.date),
                reason: String(v.reason),
              },
            ];
        }
        await save(next, "Encerramento: " + r.name);
      },
    });
  }
  function editCost(c: Campaign, cost?: Cost) {
    open({
      title: cost ? "Ajustar custo da campanha" : "Adicionar custo à campanha",
      description:
        "Estimativa e pendência não movimentam saldo. Confirme consumo por carteira/recurso ou por uma despesa a pagar. Rateio vincula despesa compartilhada já cadastrada.",
      fields: [
        select("source", "Componente", cost?.source ?? "meta", sourceNames),
        select("status", "Apuração", cost?.status ?? "pending", {
          pending: "Pendente",
          estimated: "Estimado",
          confirmed: "Confirmado",
        }),
        {
          name: "amount",
          label: "Valor (R$)",
          type: "money",
          value: cost?.amount,
        },
        {
          name: "date",
          label: "Competência do consumo/custo",
          type: "date",
          value: cost?.date,
        },
        {
          name: "due",
          label: "Vencimento (se gerar conta a pagar)",
          type: "date",
          value: cost?.entryId
            ? s.entries.find((e) => e.id === cost.entryId)?.due
            : null,
        },
        {
          name: "resourceId",
          label: "Recurso utilizado",
          type: "select",
          value: cost?.resourceId ?? "",
          options: options(s.resources),
        },
        {
          name: "walletId",
          label: "Carteira consumida",
          type: "select",
          value: cost?.walletId ?? "",
          options: options(s.accounts.filter((a) => a.kind === "wallet")),
        },
        {
          name: "entryId",
          label: "Despesa existente ou compartilhada",
          type: "select",
          value: cost?.entryId ?? "",
          options: options(
            s.entries.filter(
              (e) =>
                e.kind === "expense" && (e.shared || e.campaignId === c.id),
            ),
          ),
        },
        {
          name: "quantity",
          label: "Quantidade consumida/cobrada pelo fornecedor",
          type: "number",
          value: cost?.quantity,
        },
        {
          name: "delivered",
          label: "Entregas dessa BM, se conhecidas",
          type: "number",
          value: cost?.delivered,
        },
        {
          name: "basis",
          label: "Base de cobrança ou critério de distribuição",
          type: "textarea",
          value: cost?.basis,
          hint: "Informe enviada, entregue, cobrada, horas ou distribuição manual documentada.",
        },
        {
          name: "notes",
          label: "Observações e motivo do ajuste",
          type: "textarea",
          value: cost?.notes,
        },
      ],
      save: async (v) => {
        const next = structuredClone(s);
        const item = {
          ...v,
          id: cost?.id ?? uid(),
          campaignId: c.id,
          date: v.date || null,
          budgetAmount:
            cost?.budgetAmount ??
            (cost?.status === "estimated" ? cost.amount : null),
        } as unknown as Cost;
        delete (item as Cost & { due?: unknown }).due;
        if (
          item.status === "confirmed" &&
          item.source === "chip" &&
          item.resourceId
        ) {
          const r = s.resources.find((r) => r.id === item.resourceId);
          if (
            r?.amount !== null &&
            r?.amount !== undefined &&
            item.quantity !== null
          )
            item.amount = mulDiv(r.amount, item.quantity, r.quantity);
        }
        if (
          item.status === "confirmed" &&
          !item.resourceId &&
          !item.walletId &&
          item.source !== "shared"
        ) {
          if (!item.entryId) {
            if (!v.due) throw Error("Informe vencimento do custo confirmado.");
            const e: Entry = {
              id: uid(),
              name: sourceNames[item.source] + " · " + c.name,
              kind: "expense",
              amount: item.amount!,
              competence: item.date!,
              due: String(v.due),
              campaignId: c.id,
              client: c.client,
              shared: false,
              category: sourceNames[item.source],
              notes: item.notes,
              legacyKey: "",
            };
            next.entries.push(e);
            item.entryId = e.id;
          } else if (cost?.entryId === item.entryId)
            next.entries = next.entries.map((e) =>
              e.id === item.entryId
                ? {
                    ...e,
                    amount: item.amount!,
                    competence: item.date!,
                    due: String(v.due || e.due),
                  }
                : e,
            );
        }
        next.costs = cost
          ? next.costs.map((x) => (x.id === cost.id ? item : x))
          : [...next.costs, item];
        await save(
          next,
          "Apuração de " + sourceNames[item.source] + " · " + c.name,
        );
      },
    });
  }
  function requirements(c: Campaign) {
    open({
      title: "Componentes não aplicáveis",
      description:
        "Justifique apenas componentes que não se aplicam. Valor desconhecido deve continuar pendente.",
      fields: Object.entries(sourceNames)
        .filter(([key]) => key !== "other")
        .map(([name, label]) => ({
          name,
          label,
          value: c.notApplicable[name as Source] ?? "",
        })),
      save: async (v) =>
        save(
          patch("campaigns", {
            ...c,
            notApplicable: v as Partial<Record<Source, string>>,
          }),
          "Justificativas: " + c.name,
        ),
    });
  }
  function price(c: Campaign) {
    const p = c.pricing;
    open({
      title: "Simulador de preço · " + c.name,
      description:
        "Acréscimo incide sobre custo. Margem é resultado/receita. Impostos e taxas são parâmetros informados pelo usuário.",
      fields: [
        select("mode", "Forma de cobrança", p.mode, {
          message: "Preço por mensagem",
          fixed: "Preço fechado",
          operation: "Consumo + taxa de operação",
          markup: "Acréscimo sobre custo",
        }),
        select("basis", "Base das mensagens", p.basis, {
          sent: "Enviadas",
          delivered: "Entregues",
        }),
        {
          name: "unit",
          label: "Preço por mensagem (R$)",
          type: "decimal",
          value: p.unitMicros / 10000,
        },
        {
          name: "fixed",
          label: "Preço fechado (R$)",
          type: "money",
          value: p.fixed,
        },
        {
          name: "operationFee",
          label: "Taxa de operação (R$)",
          type: "money",
          value: p.operationFee,
        },
        ...(["markupBps", "taxBps", "feesBps", "commissionBps"] as const).map(
          (name, i): Field => ({
            name,
            label: [
              "Acréscimo sobre custo (%)",
              "Impostos sobre receita (%)",
              "Taxas sobre receita (%)",
              "Comissões sobre receita (%)",
            ][i],
            type: "decimal",
            value: p[name] / 100,
            step: "0.01",
          }),
        ),
      ],
      save: async (v) =>
        save(
          patch("campaigns", {
            ...c,
            pricing: {
              mode: v.mode,
              basis: v.basis,
              unitMicros: Math.round(Number(v.unit ?? 0) * 10000),
              fixed: v.fixed ?? 0,
              operationFee: v.operationFee ?? 0,
              markupBps: Math.round(Number(v.markupBps ?? 0) * 100),
              taxBps: Math.round(Number(v.taxBps ?? 0) * 100),
              feesBps: Math.round(Number(v.feesBps ?? 0) * 100),
              commissionBps: Math.round(Number(v.commissionBps ?? 0) * 100),
            } as PriceInput,
          }),
          "Simulação: " + c.name,
        ),
    });
  }
  function estimateShared(c: Campaign) {
    open({
      title: "Orçamento da estrutura",
      description: `Estrutura de referência: ${currency(budgetStructure(s, c.performed || c.planned))}. Base conservadora: ${s.settings.budgetVolume} mensagens/mês. Nenhum pagamento será criado.`,
      fields: [
        select("basis", "Base compatível com o orçamento", "delivered", {
          delivered: "Entregues",
          sent: "Enviadas",
        }),
        {
          name: "volume",
          label: "Quantidade na base selecionada",
          type: "number",
          value: c.delivered,
          required: true,
        },
      ],
      save: async (v) => {
        if (s.costs.some((x) => x.campaignId === c.id && x.source === "shared"))
          throw Error("A campanha já possui rateio. Ajuste o custo existente.");
        await save(
          patch("costs", {
            id: uid(),
            campaignId: c.id,
            source: "shared",
            status: "estimated",
            amount: mulDiv(
              budgetStructure(s, c.performed || c.planned),
              Number(v.volume),
              s.settings.budgetVolume,
            ),
            date: null,
            resourceId: "",
            entryId: "",
            walletId: "",
            quantity: Number(v.volume),
            delivered: null,
            basis: `Orçamento por ${v.basis}: ${v.volume}/${s.settings.budgetVolume}`,
            notes:
              "Confirmar periodicidade, vigência e volume real no fechamento.",
          }),
          "Orçamento: " + c.name,
        );
      },
    });
  }
  function allocateShared() {
    open({
      title: "Ratear despesa compartilhada",
      description:
        "Participam todas as campanhas próprias e de clientes com data no período. Escolha uma base única. A despesa entra uma vez na DRE.",
      fields: [
        {
          name: "entryId",
          label: "Despesa compartilhada",
          type: "select",
          options: options(
            s.entries.filter((e) => e.shared),
            "Selecione",
          ),
          required: true,
        },
        select("basis", "Critério", "delivered", {
          delivered: "Entregues",
          sent: "Enviadas",
          hours: "Minutos de trabalho",
        }),
        {
          name: "reason",
          label: "Documentação do rateio",
          type: "textarea",
          required: true,
        },
      ],
      save: async (v) => {
        const e = s.entries.find((x) => x.id === v.entryId)!;
        const participants = s.campaigns.filter(
          (c) =>
            c.operational !== "cancelled" &&
            inPeriod(c.performed || c.planned, from, to),
        );
        if (!participants.length) throw Error("Não há campanhas no período.");
        const weights = participants.map(
          (c) => c[v.basis as "delivered" | "sent" | "hours"],
        );
        if (weights.some((w) => w === null))
          throw Error("Informe a base em todas as campanhas participantes.");
        if (s.costs.some((x) => x.entryId === e.id && x.status === "confirmed"))
          throw Error("Despesa já rateada. Ajuste os vínculos existentes.");
        const amounts = splitCents(e.amount, weights as number[]);
        const next = structuredClone(s);
        participants.forEach((c, i) => {
          const estimate = next.costs.find(
            (x) =>
              x.campaignId === c.id &&
              x.source === "shared" &&
              x.status === "estimated",
          );
          const actual: Cost = {
            id: estimate?.id ?? uid(),
            campaignId: c.id,
            source: "shared",
            status: "confirmed",
            amount: amounts[i],
            budgetAmount: estimate?.amount ?? null,
            date: e.competence,
            resourceId: "",
            walletId: "",
            entryId: e.id,
            quantity: weights[i],
            delivered: null,
            basis: String(v.basis) + ": " + v.reason,
            notes: estimate
              ? "Orçamento anterior: " + currency(estimate.amount)
              : "",
          };
          next.costs = estimate
            ? next.costs.map((x) => (x.id === estimate.id ? actual : x))
            : [...next.costs, actual];
        });
        await save(next, "Rateio realizado: " + e.name);
      },
    });
  }
  function allocateRevenue(c: Campaign) {
    open({
      title: "Distribuir receita entre BMs",
      description:
        "A receita será distribuída uma vez pelo critério escolhido. Isso não cria faturamento adicional e não comprova recuperação financeira do investimento.",
      fields: [
        select("basis", "Critério de distribuição", "delivered", {
          delivered: "Entregas conhecidas por BM",
          equal: "Partes iguais (decisão manual)",
        }),
        {
          name: "reason",
          label: "Justificativa",
          type: "textarea",
          required: true,
        },
      ],
      save: async (v) => {
        const total = campaignTotals(s, c).revenue;
        if (total === null)
          throw Error("Registre uma receita atribuível à campanha.");
        const bms = [
          ...new Set(
            s.costs
              .filter(
                (x) =>
                  x.campaignId === c.id && x.source === "bm" && x.resourceId,
              )
              .map((x) => x.resourceId),
          ),
        ];
        if (!bms.length)
          throw Error("Associe as BMs nos custos antes de distribuir.");
        const weights = bms.map((id) =>
          v.basis === "equal"
            ? 1
            : s.costs
                .filter((x) => x.campaignId === c.id && x.resourceId === id)
                .reduce((n, x) => {
                  if (x.delivered === null)
                    throw Error("Há entregas por BM não informadas.");
                  return n + x.delivered;
                }, 0),
        );
        const values = splitCents(total, weights);
        const next = structuredClone(s);
        bms.forEach((id, i) => {
          const old = next.revenueShares.find(
            (x) => x.campaignId === c.id && x.resourceId === id,
          );
          const share = {
            id: old?.id ?? uid(),
            campaignId: c.id,
            resourceId: id,
            amount: values[i],
            basis: String(v.basis) + ": " + v.reason,
          };
          next.revenueShares = old
            ? next.revenueShares.map((x) => (x.id === old.id ? share : x))
            : [...next.revenueShares, share];
        });
        await save(next, "Distribuição da receita: " + c.name);
      },
    });
  }
  return {
    patch,
    editAccount,
    editCampaign,
    editEntry,
    settle,
    editResource,
    closeResource,
    editCost,
    requirements,
    price,
    estimateShared,
    allocateShared,
    allocateRevenue,
  };
}

