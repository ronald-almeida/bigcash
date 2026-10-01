import { movements, type Entry } from "./finance.ts";
export function overdueDebts(entries: Entry[], date: string) {
  return movements(entries, "2000-01-01", date)
    .filter(
      (e) =>
        e.kind !== "income" &&
        e.id === e.sourceId &&
        e.status === "pending" &&
        e.occurrence < date,
    )
    .map((e) => ({
      ...e,
      daysLate: Math.round(
        (Date.parse(date + "T12:00:00Z") -
          Date.parse(e.occurrence + "T12:00:00Z")) /
          86400000,
      ),
    }))
    .sort((a, b) => a.occurrence.localeCompare(b.occurrence));
}
