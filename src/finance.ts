export type Kind =
  "income" | "daily" | "tool" | "bm" | "fixed" | "salary" | "payroll" | "fee";
export type Entry = {
  id: string;
  kind: Kind;
  name: string;
  amount: number;
  date: string;
  category: string;
  notes: string;
  recurring: boolean;
  endDate: string;
  status: "paid" | "pending";
  feeType: "fixed" | "percent";
  feeValue: number;
  feeClass: "tax" | "service";
  incomeId: string;
  parts: { name: string; amount: number }[];
  review: boolean;
};
export type Movement = Entry & {
  occurrence: string;
  total: number;
  sourceId: string;
};
export const labels: Record<Kind, string> = {
  income: "Receitas",
  daily: "Gastos diários",
  tool: "Ferramentas",
  bm: "Farm de BM",
  fixed: "Despesas fixas",
  salary: "Pró-labore",
  payroll: "Folha salarial",
  fee: "Taxas e impostos",
};
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const displayDate = (s: string) => s.split("-").reverse().join("/");
export const validDate = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s &&
  s >= "2000-01-01" &&
  s <= "2100-12-31";
export const feeAmount = (base: number, type: string, value: number) =>
  type === "percent" ? Math.round((base * value) / 10000) : value;
export const entryAmount = (e: Entry, all: Entry[]) =>
  e.kind === "bm"
    ? e.parts.reduce((s, p) => s + p.amount, 0)
    : e.kind === "fee"
      ? feeAmount(
          all.find((x) => x.id === e.incomeId)?.amount ?? 0,
          e.feeType,
          e.feeValue,
        )
      : e.amount;
export function movements(all: Entry[], from: string, to: string): Movement[] {
  const out: Movement[] = [];
  for (const e of all) {
    let dates = [e.date];
    if (e.recurring) {
      dates = [];
      const start = new Date(e.date + "T12:00:00Z");
      for (
        let y = start.getUTCFullYear(), m = start.getUTCMonth();
        y <= Number(to.slice(0, 4));
      ) {
        const day = Math.min(
          start.getUTCDate(),
          new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
        );
        const d = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (d > to || (e.endDate && d > e.endDate)) break;
        dates.push(d);
        if (++m === 12) {
          m = 0;
          y++;
        }
      }
    }
    for (const d of dates)
      if (d >= from && d <= to) {
        out.push({
          ...e,
          occurrence: d,
          total: entryAmount(e, all),
          sourceId: e.id,
        });
        if (e.kind === "income" && e.feeValue > 0)
          out.push({
            ...e,
            id: e.id + "-fee",
            kind: "fee",
            name: "Taxa · " + e.name,
            occurrence: d,
            total: feeAmount(e.amount, e.feeType, e.feeValue),
            sourceId: e.id,
            feeClass: e.feeClass,
          });
      }
  }
  return out.sort((a, b) => b.occurrence.localeCompare(a.occurrence));
}
export function totals(rows: Movement[]) {
  const paid = rows.filter((x) => x.status === "paid");
  const income = paid
    .filter((x) => x.kind === "income")
    .reduce((s, x) => s + x.total, 0);
  const expense = paid
    .filter((x) => x.kind !== "income")
    .reduce((s, x) => s + x.total, 0);
  return { income, expense, net: income - expense };
}
export function validate(input: unknown): Entry {
  const e = input as Entry;
  const fail = (s: string): never => {
    throw new Error(s);
  };
  if (!e || typeof e !== "object" || !Object.hasOwn(labels, e.kind))
    fail("Tipo de lançamento inválido.");
  if (typeof e.name !== "string" || !e.name.trim() || e.name.length > 120)
    fail("Informe uma descrição de até 120 caracteres.");
  if (
    !validDate(e.date) ||
    (e.endDate !== "" && !validDate(e.endDate)) ||
    (e.endDate && e.endDate < e.date)
  )
    fail("Confira as datas do lançamento.");
  const val = (n: unknown) =>
    Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 100000000000;
  if (
    !val(e.amount) ||
    !val(e.feeValue) ||
    !["fixed", "percent"].includes(e.feeType) ||
    (e.feeType === "percent" && e.feeValue > 10000)
  )
    fail("Valor ou taxa inválidos.");
  if (
    !["paid", "pending"].includes(e.status) ||
    !["tax", "service"].includes(e.feeClass)
  )
    fail("Situação inválida.");
  if (
    typeof e.recurring !== "boolean" ||
    typeof e.review !== "boolean" ||
    typeof e.category !== "string" ||
    e.category.length > 100 ||
    typeof e.notes !== "string" ||
    e.notes.length > 2000 ||
    typeof e.incomeId !== "string"
  )
    fail("Dados inválidos.");
  if (
    !Array.isArray(e.parts) ||
    e.parts.length > 30 ||
    e.parts.some(
      (p) =>
        !p ||
        typeof p.name !== "string" ||
        !p.name.trim() ||
        p.name.length > 100 ||
        !val(p.amount),
    )
  )
    fail("Custos da BM inválidos.");
  if (
    e.kind === "bm" &&
    (!e.parts.length || e.parts.reduce((s, p) => s + p.amount, 0) <= 0)
  )
    fail("Informe os custos da BM.");
  if (e.kind !== "bm" && e.kind !== "fee" && e.amount <= 0)
    fail("O valor deve ser maior que zero.");
  if (e.kind === "fee" && (e.feeValue <= 0 || !e.incomeId))
    fail("Selecione uma receita e informe a taxa.");
  if (e.recurring && !["tool", "fixed", "salary", "payroll"].includes(e.kind))
    fail("Recorrência não permitida para este lançamento.");
  return {
    id: typeof e.id === "string" ? e.id : "",
    kind: e.kind,
    name: e.name.trim(),
    amount: e.amount,
    date: e.date,
    category: e.category,
    notes: e.notes,
    recurring: e.recurring,
    endDate: e.endDate,
    status: e.status,
    feeType: e.feeType,
    feeValue: e.feeValue,
    feeClass: e.feeClass,
    incomeId: e.incomeId,
    parts: e.parts,
    review: e.review,
  };
}
