import { validDate } from "./finance.ts";

// Money is always stored as integer cents; null means unknown, never zero.
export type Source =
  "platform" | "meta" | "bm" | "profile" | "chip" | "work" | "other" | "shared";
export const sourceNames: Record<Source, string> = {
  platform: "Consumo da plataforma",
  meta: "Meta",
  bm: "BM",
  profile: "Perfil",
  chip: "Chip",
  work: "Trabalho",
  other: "Outros custos",
  shared: "Estrutura compartilhada",
};
export interface Account {
  id: string;
  name: string;
  owner: string;
  kind: "bank" | "wallet";
  availability: "available" | "blocked" | "restricted";
  opening: number | null;
  openingDate: string | null;
  source: string;
  updatedAt: string | null;
  reserve: number;
}
export interface Campaign {
  id: string;
  name: string;
  client: string;
  own: boolean;
  planned: string | null;
  performed: string | null;
  operational: "planned" | "running" | "completed" | "cancelled";
  financial: "estimated" | "review" | "closed";
  expected: number | null;
  sent: number | null;
  delivered: number | null;
  failed: number | null;
  billed: number | null;
  hours: number | null;
  notes: string;
  notApplicable: Partial<Record<Source, string>>;
  pricing: PriceInput;
}
export interface Resource {
  id: string;
  name: string;
  kind: "bm" | "profile" | "chip";
  amount: number | null;
  acquired: string | null;
  quantity: number;
  limit: number | null;
  status: "available" | "in_use" | "closed";
  ended: string | null;
  reason: string;
  policy: string;
  recoveredStatement: string;
  entryId: string;
}
export interface Entry {
  id: string;
  name: string;
  kind: "income" | "expense" | "asset";
  amount: number;
  competence: string;
  due: string;
  campaignId: string;
  client: string;
  shared: boolean;
  category: string;
  notes: string;
  legacyKey: string;
}
export interface Settlement {
  id: string;
  kind: "receipt" | "payment" | "transfer" | "topup" | "refund";
  amount: number;
  date: string;
  accountId: string;
  targetId: string;
  entryId: string;
  reversalOf: string;
  notes: string;
}
export interface Cost {
  id: string;
  campaignId: string;
  source: Source;
  status: "estimated" | "confirmed" | "pending";
  amount: number | null;
  budgetAmount?: number | null;
  date: string | null;
  resourceId: string;
  walletId: string;
  entryId: string;
  quantity: number | null;
  delivered: number | null;
  basis: string;
  notes: string;
}
export interface WriteOff {
  id: string;
  resourceId: string;
  amount: number;
  date: string;
  reason: string;
}
export interface RevenueShare {
  id: string;
  campaignId: string;
  resourceId: string;
  amount: number;
  basis: string;
}
export interface Statement {
  id: string;
  accountId: string;
  externalId: string;
  fingerprint: string;
  date: string;
  amount: number;
  memo: string;
  raw: string;
  batchId: string;
  matches: { settlementId: string; amount: number }[];
}
export interface ImportBatch {
  id: string;
  accountId: string;
  name: string;
  hash: string;
  importedAt: string;
  raw: string;
}
export interface Rate {
  id: string;
  name: string;
  amount: number;
  quantity: number;
  effective: string | null;
  periodicity: "unconfirmed" | "monthly" | "once";
  confirmed: boolean;
}
export interface Settings {
  rates: Rate[];
  budgetVolume: number;
  commercialReference: number;
  reserveTarget: number;
  reserveMonths: number;
}
export interface State {
  accounts: Account[];
  campaigns: Campaign[];
  resources: Resource[];
  entries: Entry[];
  settlements: Settlement[];
  costs: Cost[];
  writeOffs: WriteOff[];
  revenueShares: RevenueShare[];
  statements: Statement[];
  imports: ImportBatch[];
  settings: Settings;
}
export interface PriceInput {
  mode: "message" | "fixed" | "operation" | "markup";
  basis: "sent" | "delivered";
  unitMicros: number;
  fixed: number;
  operationFee: number;
  markupBps: number;
  taxBps: number;
  feesBps: number;
  commissionBps: number;
}
export const emptyPrice = (): PriceInput => ({
  mode: "message",
  basis: "delivered",
  unitMicros: 3000,
  fixed: 0,
  operationFee: 0,
  markupBps: 0,
  taxBps: 0,
  feesBps: 0,
  commissionBps: 0,
});
export const initialState = (): State => ({
  accounts: [],
  campaigns: [],
  resources: [],
  entries: [],
  settlements: [],
  costs: [],
  writeOffs: [],
  revenueShares: [],
  statements: [],
  imports: [],
  settings: {
    rates: [
      {
        id: "profiles",
        name: "Perfis adquiridos (referência, não é lançamento)",
        amount: 4000,
        quantity: 44,
        effective: null,
        periodicity: "once",
        confirmed: false,
      },
      {
        id: "manager",
        name: "Gerenciamento de perfis",
        amount: 11200,
        quantity: 1,
        effective: null,
        periodicity: "unconfirmed",
        confirmed: false,
      },
      {
        id: "proxy",
        name: "Proxies",
        amount: 2200,
        quantity: 3,
        effective: null,
        periodicity: "unconfirmed",
        confirmed: false,
      },
      {
        id: "subscription",
        name: "Assinatura de disparo",
        amount: 29700,
        quantity: 1,
        effective: null,
        periodicity: "unconfirmed",
        confirmed: false,
      },
      {
        id: "chip",
        name: "Chip (referência unitária)",
        amount: 1500,
        quantity: 1,
        effective: null,
        periodicity: "once",
        confirmed: false,
      },
    ],
    budgetVolume: 30000,
    commercialReference: 3000,
    reserveTarget: 0,
    reserveMonths: 0,
  },
});
export const sum = <T>(rows: T[], value: (row: T) => number) =>
  rows.reduce((n, row) => n + value(row), 0);
export const ratio = (n: number, d: number | null) =>
  d !== null && d > 0 ? n / d : null;
export function mulDiv(a: number, b: number, divisor: number) {
  if (
    ![a, b, divisor].every(Number.isSafeInteger) ||
    a < 0 ||
    b < 0 ||
    divisor <= 0
  )
    throw Error("Cálculo monetário inválido.");
  const value = Number(
    (BigInt(a) * BigInt(b) * 2n + BigInt(divisor)) / (BigInt(divisor) * 2n),
  );
  if (!Number.isSafeInteger(value))
    throw Error("Resultado monetário excede a precisão suportada.");
  return value;
}
export const inPeriod = (date: string | null, from: string, to: string) =>
  date !== null && date >= from && date <= to;
export function splitCents(amount: number, weights: number[]): number[] {
  const total = sum(weights, (x) => x);
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    weights.some((w) => !Number.isSafeInteger(w) || w < 0)
  )
    throw Error("Informe pesos inteiros positivos para o rateio.");
  const parts = weights.map((w) =>
    Number((BigInt(amount) * BigInt(w)) / BigInt(total)),
  );
  const rank = weights
    .map((w, i) => ({ i, rest: (BigInt(amount) * BigInt(w)) % BigInt(total) }))
    .sort((a, b) => (a.rest === b.rest ? a.i - b.i : a.rest > b.rest ? -1 : 1));
  let left = amount - sum(parts, (x) => x);
  for (const item of rank) if (left-- > 0) parts[item.i]++;
  return parts;
}
export function accountBalance(
  s: State,
  a: Account,
  asOf: string,
): number | null {
  if (a.opening === null || !a.openingDate || a.openingDate > asOf) return null;
  let balance = a.opening;
  for (const m of s.settlements.filter(
    (m) => m.date >= a.openingDate! && m.date <= asOf,
  )) {
    if (m.accountId === a.id) {
      const original = m.reversalOf
        ? s.settlements.find((x) => x.id === m.reversalOf)
        : null;
      balance +=
        m.amount *
        (m.kind === "receipt" ||
        (m.kind === "refund" && original?.kind === "payment")
          ? 1
          : -1);
    }
    if (m.targetId === a.id) balance += m.amount;
  }
  balance -= sum(
    s.costs.filter(
      (c) =>
        c.walletId === a.id &&
        c.status === "confirmed" &&
        c.date! >= a.openingDate! &&
        c.date! <= asOf,
    ),
    (c) => c.amount!,
  );
  return balance;
}
export function settled(s: State, entryId: string, asOf = "2100-12-31") {
  return sum(
    s.settlements.filter((m) => m.entryId === entryId && m.date <= asOf),
    (m) => (m.kind === "refund" ? -m.amount : m.amount),
  );
}
export function outstanding(s: State, e: Entry, asOf = "2100-12-31") {
  return e.amount - settled(s, e.id, asOf);
}
export function assigned(s: State, resourceId: string) {
  return (
    sum(
      s.costs.filter(
        (c) => c.resourceId === resourceId && c.status === "confirmed",
      ),
      (c) => c.amount!,
    ) +
    sum(
      s.writeOffs.filter((w) => w.resourceId === resourceId),
      (w) => w.amount,
    )
  );
}
export function stock(s: State, r: Resource) {
  return r.status === "closed"
    ? 0
    : r.quantity -
        sum(
          s.costs.filter(
            (c) => c.resourceId === r.id && c.status === "confirmed",
          ),
          (c) => c.quantity ?? 0,
        );
}
export function budgetStructure(s: State, date: string | null) {
  return sum(
    s.settings.rates.filter(
      (r) =>
        r.periodicity !== "once" &&
        (!r.effective || !date || r.effective <= date),
    ),
    (r) => r.amount * r.quantity,
  );
}
export function campaignTotals(s: State, c: Campaign) {
  const costs = s.costs.filter((x) => x.campaignId === c.id);
  const standalone = sum(
    s.entries.filter(
      (e) =>
        e.kind === "expense" &&
        e.campaignId === c.id &&
        !costs.some((x) => x.status === "confirmed" && x.entryId === e.id),
    ),
    (e) => e.amount,
  );
  const confirmed =
    sum(
      costs.filter((x) => x.status === "confirmed"),
      (x) => x.amount ?? 0,
    ) + standalone;
  const estimated = sum(
    costs.filter((x) => x.status === "estimated"),
    (x) => x.amount ?? 0,
  );
  const required: Source[] = [
    "platform",
    "meta",
    "bm",
    "profile",
    "chip",
    "work",
    "shared",
  ];
  const missing = required.filter(
    (source) =>
      !c.notApplicable[source]?.trim() &&
      !costs.some((x) => x.source === source && x.status === "confirmed"),
  );
  const pending = [
    ...new Set([
      ...missing,
      ...costs.filter((x) => x.status !== "confirmed").map((x) => x.source),
    ]),
  ];
  const income = s.entries.filter(
    (e) => e.kind === "income" && e.campaignId === c.id,
  );
  const revenue = income.length ? sum(income, (e) => e.amount) : null;
  const shared = sum(
    costs.filter((x) => x.source === "shared"),
    (x) => x.amount ?? 0,
  );
  const total = confirmed + estimated;
  const hasCosts =
    costs.some((x) => x.amount !== null) ||
    standalone > 0 ||
    pending.length === 0;
  return {
    confirmed,
    estimated,
    total,
    hasCosts,
    direct: total - shared,
    shared,
    pending,
    complete: pending.length === 0,
    revenue,
    result: revenue === null || !hasCosts ? null : revenue - total,
    sentUnit: hasCosts ? ratio(total, c.sent) : null,
    deliveredUnit: hasCosts ? ratio(total, c.delivered) : null,
  };
}
export function simulate(s: State, c: Campaign, p = c.pricing) {
  const t = campaignTotals(s, c);
  const volume = p.basis === "sent" ? c.sent : c.delivered;
  const consumption = sum(
    s.costs.filter(
      (x) => x.campaignId === c.id && ["meta", "platform"].includes(x.source),
    ),
    (x) => x.amount ?? 0,
  );
  const revenue =
    p.mode === "message"
      ? volume === null || volume <= 0
        ? null
        : mulDiv(volume, p.unitMicros, 100)
      : p.mode === "fixed"
        ? p.fixed
        : p.mode === "operation"
          ? consumption + p.operationFee
          : mulDiv(t.total, 10000 + p.markupBps, 10000);
  const deductions =
    revenue === null
      ? null
      : sum([p.taxBps, p.feesBps, p.commissionBps], (bps) =>
          mulDiv(revenue, bps, 10000),
        );
  const result = revenue === null ? null : revenue - deductions! - t.total;
  const required: Source[] = [
    "platform",
    "meta",
    "bm",
    "profile",
    "chip",
    "work",
    "shared",
  ];
  const complete =
    revenue !== null &&
    required.every(
      (k) =>
        c.notApplicable[k]?.trim() ||
        s.costs.some(
          (x) =>
            x.campaignId === c.id &&
            x.source === k &&
            x.amount !== null &&
            x.status !== "pending",
        ),
    ) &&
    !s.costs.some(
      (x) =>
        x.campaignId === c.id && (x.amount === null || x.status === "pending"),
    );
  return {
    revenue,
    deductions,
    result,
    margin: revenue && result !== null ? result / revenue : null,
    complete,
    unit: revenue !== null ? ratio(revenue, volume) : null,
  };
}
export function dre(
  s: State,
  from: string,
  to: string,
  campaignIds?: Set<string>,
  entryIds?: Set<string>,
) {
  const entries = s.entries.filter(
    (e) =>
      inPeriod(e.competence, from, to) &&
      (entryIds
        ? entryIds.has(e.id)
        : !campaignIds || campaignIds.has(e.campaignId)) &&
      (!campaignIds || !e.shared),
  );
  const revenue = sum(
    entries.filter((e) => e.kind === "income"),
    (e) => e.amount,
  );
  const expenses = sum(
    entries.filter((e) => e.kind === "expense"),
    (e) => e.amount,
  );
  // Linked invoices and shared allocations already exist in entries. Never expense them twice.
  const consumption = sum(
    s.costs.filter(
      (c) =>
        c.status === "confirmed" &&
        ((!c.entryId && c.source !== "shared") ||
          (campaignIds && c.source === "shared")) &&
        inPeriod(c.date, from, to) &&
        (!campaignIds || campaignIds.has(c.campaignId)),
    ),
    (c) => c.amount!,
  );
  const writeOff = campaignIds
    ? 0
    : sum(
        s.writeOffs.filter((w) => inPeriod(w.date, from, to)),
        (w) => w.amount,
      );
  return {
    revenue,
    expenses,
    consumption,
    writeOff,
    result: revenue - expenses - consumption - writeOff,
  };
}
export function forecast(s: State, from: string, to: string, asOf: string) {
  const days = new Map<
    string,
    {
      date: string;
      receipts: number;
      payments: number;
      expectedReceipts: number;
      expectedPayments: number;
    }
  >();
  const day = (date: string) => {
    if (!days.has(date))
      days.set(date, {
        date,
        receipts: 0,
        payments: 0,
        expectedReceipts: 0,
        expectedPayments: 0,
      });
    return days.get(date)!;
  };
  for (const m of s.settlements.filter(
    (m) =>
      inPeriod(m.date, from, to) &&
      m.date <= asOf &&
      !["transfer", "topup"].includes(m.kind),
  )) {
    const original = s.settlements.find((x) => x.id === m.reversalOf);
    if (m.kind === "receipt") day(m.date).receipts += m.amount;
    else if (m.kind === "payment") day(m.date).payments += m.amount;
    else if (original?.kind === "payment") day(m.date).payments -= m.amount;
    else day(m.date).receipts -= m.amount;
  }
  for (const e of s.entries) {
    const left = outstanding(s, e, asOf);
    const date = e.due < asOf ? asOf : e.due;
    if (left > 0 && inPeriod(date, from, to))
      day(date)[
        e.kind === "income" ? "expectedReceipts" : "expectedPayments"
      ] += left;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
const integer = (v: unknown, max = 100000000000) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max;
const nullableNumber = (v: unknown) => v === null || integer(v);
const dateOrNull = (v: unknown) => v === null || validDate(v);
const text = (v: unknown, max = 2000) =>
  typeof v === "string" && v.length <= max;
const id = (v: unknown) => typeof v === "string" && /^[\w.:-]{1,160}$/.test(v);
const oneOf = (v: unknown, values: string[]) =>
  typeof v === "string" && values.includes(v);

export function validateState(input: unknown, previous?: State): State {
  assert(input && typeof input === "object", "Dados financeiros inválidos.");
  const s = input as State;
  for (const key of [
    "accounts",
    "campaigns",
    "resources",
    "entries",
    "settlements",
    "costs",
    "writeOffs",
    "revenueShares",
    "statements",
    "imports",
  ] as const) {
    assert(
      Array.isArray(s[key]) && s[key].length <= 10000,
      "Coleção inválida: " + key,
    );
    const ids = new Set<string>();
    for (const item of s[key]) {
      assert(
        item && id(item.id) && !ids.has(item.id),
        "Identificador inválido ou duplicado.",
      );
      ids.add(item.id);
    }
    if (previous)
      for (const old of previous[key])
        assert(
          s[key].some((x) => x.id === old.id),
          "O histórico não pode ser excluído.",
        );
  }
  const account = (key: string) => s.accounts.find((a) => a.id === key);
  const campaign = (key: string) => s.campaigns.find((a) => a.id === key);
  const entry = (key: string) => s.entries.find((a) => a.id === key);
  const resource = (key: string) => s.resources.find((a) => a.id === key);
  for (const a of s.accounts) {
    assert(
      text(a.name, 120) &&
        a.name.trim() &&
        text(a.owner, 120) &&
        oneOf(a.kind, ["bank", "wallet"]) &&
        oneOf(a.availability, ["available", "blocked", "restricted"]),
      "Confira a identificação e classificação da conta.",
    );
    assert(
      (a.opening === null ||
        (Number.isSafeInteger(a.opening) &&
          Math.abs(a.opening) <= 100000000000)) &&
        dateOrNull(a.openingDate) &&
        (a.opening === null) === (a.openingDate === null),
      "Saldo inicial e data devem ser informados juntos.",
    );
    assert(
      text(a.source, 200) &&
        dateOrNull(a.updatedAt) &&
        integer(a.reserve) &&
        (a.kind === "bank" || a.reserve === 0),
      "Origem, atualização ou reserva inválida.",
    );
  }
  for (const c of s.campaigns) {
    assert(
      text(c.name, 120) &&
        c.name.trim() &&
        text(c.client, 120) &&
        typeof c.own === "boolean" &&
        (c.own || c.client.trim()),
      "Informe nome e cliente da campanha.",
    );
    assert(
      dateOrNull(c.planned) &&
        dateOrNull(c.performed) &&
        oneOf(c.operational, [
          "planned",
          "running",
          "completed",
          "cancelled",
        ]) &&
        oneOf(c.financial, ["estimated", "review", "closed"]),
      "Situação ou datas da campanha inválidas.",
    );
    assert(
      [c.expected, c.sent, c.delivered, c.failed, c.billed, c.hours].every(
        nullableNumber,
      ),
      "Volumes e minutos de trabalho devem ser inteiros ou não informados.",
    );
    assert(
      c.sent === null || (c.delivered ?? 0) + (c.failed ?? 0) <= c.sent,
      "Entregas e falhas excedem o envio informado.",
    );
    assert(
      text(c.notes) &&
        c.notApplicable &&
        typeof c.notApplicable === "object" &&
        Object.entries(c.notApplicable).every(
          ([k, v]) => k in sourceNames && text(v, 500),
        ),
      "Justificativas inválidas.",
    );
    const p = c.pricing;
    assert(
      p &&
        oneOf(p.mode, ["message", "fixed", "operation", "markup"]) &&
        oneOf(p.basis, ["sent", "delivered"]) &&
        [
          p.unitMicros,
          p.fixed,
          p.operationFee,
          p.markupBps,
          p.taxBps,
          p.feesBps,
          p.commissionBps,
        ].every((v) => integer(v, 100000000)),
      "Precificação inválida.",
    );
    assert(
      p.taxBps + p.feesBps + p.commissionBps < 10000,
      "Deduções devem ser menores que 100%.",
    );
  }
  const legacyKeys = new Set<string>();
  for (const e of s.entries) {
    assert(
      text(e.name, 120) &&
        e.name.trim() &&
        oneOf(e.kind, ["income", "expense", "asset"]) &&
        integer(e.amount) &&
        e.amount > 0 &&
        validDate(e.competence) &&
        validDate(e.due),
      "Confira valor e datas do lançamento.",
    );
    assert(
      text(e.campaignId, 160) &&
        (!e.campaignId || campaign(e.campaignId)) &&
        text(e.client, 120) &&
        text(e.category, 100) &&
        text(e.notes) &&
        typeof e.shared === "boolean" &&
        (!e.shared || (e.kind === "expense" && !e.campaignId)),
      "Vínculos do lançamento inválidos.",
    );
    assert(
      text(e.legacyKey, 250) && (!e.legacyKey || !legacyKeys.has(e.legacyKey)),
      "Registro legado já convertido.",
    );
    if (e.legacyKey) legacyKeys.add(e.legacyKey);
    assert(
      settled(s, e.id) >= 0 && settled(s, e.id) <= e.amount,
      "Liquidação excede o valor do lançamento.",
    );
  }
  for (const r of s.resources) {
    assert(
      text(r.name, 120) &&
        r.name.trim() &&
        oneOf(r.kind, ["bm", "profile", "chip"]) &&
        nullableNumber(r.amount) &&
        dateOrNull(r.acquired) &&
        integer(r.quantity, 1000000) &&
        r.quantity > 0 &&
        nullableNumber(r.limit),
      "Dados de aquisição do recurso inválidos.",
    );
    assert(
      oneOf(r.status, ["available", "in_use", "closed"]) &&
        dateOrNull(r.ended) &&
        text(r.reason) &&
        text(r.policy, 500) &&
        text(r.recoveredStatement, 500) &&
        text(r.entryId, 160),
      "Política ou encerramento inválido.",
    );
    assert(
      !r.entryId ||
        (entry(r.entryId)?.kind === "asset" &&
          entry(r.entryId)?.amount === r.amount),
      "Aquisição deve vincular um lançamento de ativo com o mesmo valor.",
    );
    assert(
      r.amount === null
        ? assigned(s, r.id) === 0
        : assigned(s, r.id) <= r.amount,
      "Custo atribuído excede a aquisição do recurso.",
    );
    assert(
      !r.entryId ||
        s.resources.filter((x) => x.entryId === r.entryId).length === 1,
      "Aquisição já vinculada a outro recurso. Use um lote ou separe os títulos.",
    );
    assert(
      r.kind !== "chip" ||
        sum(
          s.costs.filter(
            (c) => c.resourceId === r.id && c.status === "confirmed",
          ),
          (c) => c.quantity ?? 0,
        ) <= r.quantity,
      "Não há chips suficientes disponíveis.",
    );
    if (r.status === "closed")
      assert(
        r.ended &&
          r.reason.trim() &&
          r.amount !== null &&
          assigned(s, r.id) === r.amount,
        "Ao encerrar, informe data, motivo e distribua ou baixe o saldo de aquisição restante.",
      );
  }
  for (const m of s.settlements) {
    const a = account(m.accountId);
    const e = entry(m.entryId);
    assert(
      oneOf(m.kind, ["receipt", "payment", "transfer", "topup", "refund"]) &&
        integer(m.amount) &&
        m.amount > 0 &&
        validDate(m.date) &&
        a &&
        a.kind === "bank",
      "Liquidação exige uma conta bancária, data e valor válidos.",
    );
    assert(
      text(m.notes) &&
        text(m.targetId, 160) &&
        text(m.entryId, 160) &&
        text(m.reversalOf, 160),
      "Movimentação inválida.",
    );
    assert(
      !a.openingDate || m.date >= a.openingDate,
      "A movimentação antecede o saldo inicial da conta.",
    );
    if (m.kind === "transfer" || m.kind === "topup") {
      const target = account(m.targetId);
      assert(
        target &&
          target.id !== a.id &&
          !e &&
          !m.reversalOf &&
          (m.kind !== "topup" || target.kind === "wallet") &&
          (!target.openingDate || m.date >= target.openingDate),
        "Transferência deve ligar contas diferentes e não gerar receita.",
      );
    } else if (m.kind === "refund") {
      const original = s.settlements.find((x) => x.id === m.reversalOf);
      assert(
        original &&
          ["payment", "receipt"].includes(original.kind) &&
          original.accountId === m.accountId &&
          original.entryId === m.entryId &&
          m.date >= original.date &&
          !m.targetId,
        "Estorno deve referenciar um pagamento ou recebimento da mesma conta.",
      );
      assert(
        sum(
          s.settlements.filter((x) => x.reversalOf === original.id),
          (x) => x.amount,
        ) <= original.amount,
        "Estorno excede a movimentação original.",
      );
    } else
      assert(
        e &&
          !m.targetId &&
          !m.reversalOf &&
          (m.kind === "receipt") === (e.kind === "income"),
        "Pagamento/recebimento deve vincular um lançamento compatível.",
      );
  }
  for (const c of s.costs) {
    const r = resource(c.resourceId);
    const e = entry(c.entryId);
    const w = account(c.walletId);
    assert(
      campaign(c.campaignId) &&
        c.source in sourceNames &&
        oneOf(c.status, ["estimated", "confirmed", "pending"]) &&
        nullableNumber(c.amount) &&
        dateOrNull(c.date) &&
        nullableNumber(c.quantity) &&
        nullableNumber(c.delivered) &&
        text(c.basis, 500) &&
        text(c.notes),
      "Custo da campanha inválido.",
    );
    assert(
      [c.resourceId, c.entryId, c.walletId].every((x) => text(x, 160)) &&
        (!c.resourceId || r) &&
        (!c.entryId || e) &&
        (!c.walletId || w?.kind === "wallet"),
      "Origem do custo inválida.",
    );
    assert(
      c.budgetAmount === undefined || nullableNumber(c.budgetAmount),
      "Orçamento original inválido.",
    );
    assert(
      !campaign(c.campaignId)!.notApplicable[c.source]?.trim(),
      "Remova a justificativa de não aplicável antes de registrar esse custo.",
    );
    if (c.status === "confirmed") {
      assert(
        c.amount !== null && c.date,
        "Custo confirmado precisa de valor e competência.",
      );
      if (["bm", "profile", "chip"].includes(c.source)) {
        assert(
          r &&
            r.kind === c.source &&
            !e &&
            !w &&
            r.amount !== null &&
            c.basis.trim(),
          "Consumo de recurso exige aquisição conhecida e política explícita.",
        );
        if (r.acquired)
          assert(c.date >= r.acquired, "Consumo antecede a aquisição.");
        if (r.ended)
          assert(
            c.date <= r.ended,
            "Consumo posterior ao encerramento do recurso.",
          );
        if (c.source === "chip")
          assert(
            c.quantity !== null &&
              c.quantity > 0 &&
              c.amount === mulDiv(r.amount, c.quantity, r.quantity),
            "Custo dos chips deve corresponder à quantidade consumida.",
          );
      } else if (c.source === "shared") {
        assert(
          e?.kind === "expense" &&
            e.shared &&
            !r &&
            !w &&
            c.basis.trim() &&
            c.date === e.competence,
          "Rateio deve vincular uma despesa compartilhada, competência e critério.",
        );
        assert(
          sum(
            s.costs.filter(
              (x) => x.entryId === e.id && x.status === "confirmed",
            ),
            (x) => x.amount!,
          ) <= e.amount,
          "Rateios excedem a despesa compartilhada.",
        );
      } else if (w) {
        assert(
          !e &&
            !r &&
            ["platform", "meta"].includes(c.source) &&
            (!w.openingDate || c.date >= w.openingDate) &&
            c.basis.trim(),
          "Consumo de carteira exige origem identificável ou distribuição documentada.",
        );
      } else
        assert(
          e?.kind === "expense" &&
            !e.shared &&
            e.campaignId === c.campaignId &&
            e.amount === c.amount &&
            e.competence === c.date &&
            !r &&
            s.costs.filter(
              (x) => x.entryId === e.id && x.status === "confirmed",
            ).length === 1,
          "Custo direto deve vincular uma única despesa da campanha com o mesmo valor e competência.",
        );
    }
  }
  for (const w of s.writeOffs)
    assert(
      resource(w.resourceId) &&
        integer(w.amount) &&
        w.amount > 0 &&
        validDate(w.date) &&
        text(w.reason) &&
        w.reason.trim() &&
        (!resource(w.resourceId)!.acquired ||
          w.date >= resource(w.resourceId)!.acquired!),
      "Baixa de recurso inválida.",
    );
  for (const share of s.revenueShares) {
    assert(
      campaign(share.campaignId) &&
        resource(share.resourceId)?.kind === "bm" &&
        integer(share.amount) &&
        text(share.basis, 500) &&
        share.basis.trim() &&
        s.costs.some(
          (c) =>
            c.campaignId === share.campaignId &&
            c.resourceId === share.resourceId,
        ),
      "Distribuição de receita exige campanha, BM associada e critério explícito.",
    );
    const revenue = campaignTotals(s, campaign(share.campaignId)!).revenue;
    assert(
      revenue !== null &&
        sum(
          s.revenueShares.filter((x) => x.campaignId === share.campaignId),
          (x) => x.amount,
        ) <= revenue,
      "Receita distribuída excede a receita atribuível da campanha.",
    );
    assert(
      s.revenueShares.filter(
        (x) =>
          x.campaignId === share.campaignId &&
          x.resourceId === share.resourceId,
      ).length === 1,
      "BM já possui distribuição de receita nesta campanha.",
    );
  }
  for (const c of s.campaigns) {
    const resourceDeliveries = s.costs.filter(
      (x) => x.campaignId === c.id && x.source === "bm" && x.delivered !== null,
    );
    assert(
      c.delivered === null ||
        sum(resourceDeliveries, (x) => x.delivered!) <= c.delivered,
      "Entregas por BM excedem as entregas da campanha.",
    );
    if (c.financial === "closed")
      assert(
        campaignTotals(s, c).complete &&
          (c.own || campaignTotals(s, c).revenue !== null),
        "Fechamento bloqueado: existem custos pendentes, estimados ou receita do cliente não informada.",
      );
  }
  for (const b of s.imports)
    assert(
      account(b.accountId) &&
        text(b.name, 200) &&
        text(b.hash, 128) &&
        b.hash.length > 0 &&
        text(b.importedAt, 50) &&
        text(b.raw, 2000000),
      "Importação inválida.",
    );
  assert(
    new Set(s.imports.map((b) => b.accountId + ":" + b.hash)).size ===
      s.imports.length,
    "Arquivo já importado nesta conta.",
  );
  const externalIds = new Set<string>();
  for (const row of s.statements) {
    assert(
      account(row.accountId) &&
        id(row.batchId) &&
        s.imports.some(
          (x) => x.id === row.batchId && x.accountId === row.accountId,
        ) &&
        text(row.externalId, 160) &&
        text(row.fingerprint, 200) &&
        validDate(row.date) &&
        Number.isSafeInteger(row.amount) &&
        row.amount !== 0 &&
        Math.abs(row.amount) <= 100000000000 &&
        text(row.memo, 2000) &&
        text(row.raw, 20000) &&
        Array.isArray(row.matches),
      "Linha do extrato inválida.",
    );
    const key = row.accountId + ":" + (row.externalId || row.fingerprint);
    assert(!externalIds.has(key), "Movimento bancário duplicado.");
    externalIds.add(key);
    assert(
      sum(row.matches, (x) => x.amount) <= Math.abs(row.amount),
      "Conciliação excede a linha do extrato.",
    );
    assert(
      new Set(row.matches.map((x) => x.settlementId)).size ===
        row.matches.length,
      "Vínculo de conciliação repetido.",
    );
    for (const match of row.matches) {
      const m = s.settlements.find((x) => x.id === match.settlementId);
      assert(
        m &&
          integer(match.amount) &&
          match.amount > 0 &&
          (m.accountId === row.accountId || m.targetId === row.accountId),
        "Movimentação conciliada não pertence à conta.",
      );
      const original = s.settlements.find((x) => x.id === m.reversalOf);
      const positive =
        m.targetId === row.accountId ||
        m.kind === "receipt" ||
        (m.kind === "refund" && original?.kind === "payment");
      assert(
        row.amount > 0 === positive,
        "Sinais incompatíveis na conciliação.",
      );
      assert(
        sum(
          s.statements
            .filter((x) => x.accountId === row.accountId)
            .flatMap((x) => x.matches)
            .filter((x) => x.settlementId === m.id),
          (x) => x.amount,
        ) <= m.amount,
        "Movimentação já conciliada além do seu valor.",
      );
    }
  }
  assert(
    s.settings &&
      Array.isArray(s.settings.rates) &&
      s.settings.rates.length <= 200 &&
      integer(s.settings.budgetVolume, 1000000000) &&
      s.settings.budgetVolume > 0 &&
      integer(s.settings.commercialReference) &&
      integer(s.settings.reserveTarget) &&
      integer(s.settings.reserveMonths, 120),
    "Configurações inválidas.",
  );
  for (const r of s.settings.rates)
    assert(
      id(r.id) &&
        text(r.name, 150) &&
        integer(r.amount) &&
        integer(r.quantity, 1000000) &&
        r.quantity > 0 &&
        dateOrNull(r.effective) &&
        oneOf(r.periodicity, ["unconfirmed", "monthly", "once"]) &&
        typeof r.confirmed === "boolean" &&
        (!r.confirmed || (r.effective && r.periodicity !== "unconfirmed")),
      "Confirme periodicidade e vigência da referência.",
    );
  if (previous) {
    for (const old of previous.costs.filter((c) => c.status === "confirmed")) {
      const current = s.costs.find((c) => c.id === old.id)!;
      assert(
        current.status === "confirmed" &&
          current.source === old.source &&
          current.campaignId === old.campaignId &&
          current.walletId === old.walletId &&
          current.entryId === old.entryId &&
          current.resourceId === old.resourceId,
        "Custo confirmado preserva sua origem. Ajuste valor e documentação; não o transforme em pendência ou outra origem.",
      );
    }
    for (const key of ["settlements", "imports", "writeOffs"] as const)
      for (const old of previous[key])
        assert(
          JSON.stringify(old) ===
            JSON.stringify(s[key].find((x) => x.id === old.id)),
          "Movimentos originais são imutáveis. Use estorno para corrigir liquidações.",
        );
    for (const old of previous.statements) {
      const current = s.statements.find((x) => x.id === old.id)!;
      assert(
        JSON.stringify({ ...old, matches: [] }) ===
          JSON.stringify({ ...current, matches: [] }),
        "O extrato original deve ser preservado.",
      );
    }
    for (const old of previous.entries)
      if (settled(previous, old.id) > 0) {
        const current = entry(old.id)!;
        assert(
          old.kind === current.kind && old.amount === current.amount,
          "Estorne as liquidações antes de alterar o valor ou tipo do lançamento.",
        );
      }
  }
  return s;
}

