import { movements, type Entry, displayDate } from "./finance.ts";
export type FinanceAlert = {
  id: string;
  title: string;
  body: string;
  kind: "overdue" | "due" | "upcoming" | "review";
  entryKind: Entry["kind"];
  date: string;
  read?: boolean;
};
export function buildAlerts(entries: Entry[], date: string): FinanceAlert[] {
  const limit = new Date(date + "T12:00:00Z");
  limit.setUTCDate(limit.getUTCDate() + 3);
  const pending = movements(
    entries,
    "2000-01-01",
    limit.toISOString().slice(0, 10),
  ).filter((e) => e.status === "pending" && e.id === e.sourceId);
  const alerts: FinanceAlert[] = pending.map((e) => ({
    id: `${e.id}:${e.occurrence}:${e.occurrence < date ? "overdue" : e.occurrence === date ? "due" : "upcoming"}`,
    title:
      e.occurrence < date
        ? "Lançamento em atraso"
        : e.occurrence === date
          ? "Vence hoje"
          : "Próximo vencimento",
    body: `${e.name} · ${displayDate(e.occurrence)}${e.kind === "income" ? " · Receita a receber" : ""}`,
    kind:
      e.occurrence < date
        ? "overdue"
        : e.occurrence === date
          ? "due"
          : "upcoming",
    entryKind: e.kind,
    date: e.occurrence,
  }));
  for (const e of entries.filter((e) => e.review))
    alerts.push({
      id: e.id + ":review",
      title: "Gasto para revisão",
      body: e.name,
      kind: "review",
      entryKind: e.kind,
      date: e.date,
    });
  return alerts.sort(
    (a, b) =>
      ({ overdue: 0, due: 1, upcoming: 2, review: 3 })[a.kind] -
        { overdue: 0, due: 1, upcoming: 2, review: 3 }[b.kind] ||
      a.date.localeCompare(b.date),
  );
}
