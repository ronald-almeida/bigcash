import { movements, totals, type Entry } from "./finance.ts";
export type MonthlyGoal = {
  month: string;
  revenue_target: number;
  profit_target: number;
  actual_revenue: number;
  actual_profit: number;
  closed_at: string | null;
};
export const monthEnd = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
export function monthResult(entries: Entry[], month: string, date: string) {
  const end = monthEnd(month);
  const result = totals(
    movements(entries, month + "-01", end < date ? end : date),
  );
  return { actual_revenue: result.income, actual_profit: result.net };
}
export function goalStatus(
  target: number,
  actual: number,
  month: string,
  currentMonth: string,
) {
  if (!target) return "Sem meta";
  if (month > currentMonth) return "Planejada";
  if (actual >= target) return "Atingida";
  return month < currentMonth ? "Não atingida" : "Em andamento";
}
