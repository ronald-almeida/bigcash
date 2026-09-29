import { today, type Entry } from "../src/finance";
import { monthResult, type MonthlyGoal } from "../src/monthly";
export async function monthlyHistory(db: D1Database) {
  const date = today();
  const current = date.slice(0, 7);
  const [stored, source] = await Promise.all([
    db
      .prepare("SELECT * FROM monthly_goals ORDER BY month DESC")
      .all<MonthlyGoal>(),
    db.prepare("SELECT data FROM entries").all<{ data: string }>(),
  ]);
  const entries = source.results.map((r) => JSON.parse(r.data) as Entry);
  const map = new Map(stored.results.map((r) => [r.month, r]));
  const earliest = [
    ...entries.map((e) => e.date.slice(0, 7)),
    ...map.keys(),
    current,
  ].sort()[0];
  for (let month = earliest; month <= current;) {
    if (!map.has(month))
      map.set(month, {
        month,
        revenue_target: 0,
        profit_target: 0,
        actual_revenue: 0,
        actual_profit: 0,
        closed_at: null,
      });
    const next = new Date(month + "-01T12:00:00Z");
    next.setUTCMonth(next.getUTCMonth() + 1);
    month = next.toISOString().slice(0, 7);
  }
  const history: MonthlyGoal[] = [];
  for (const row of map.values()) {
    if (row.closed_at) {
      history.push(row);
      continue;
    }
    const result = { ...row, ...monthResult(entries, row.month, date) };
    if (row.month < current) {
      await db
        .prepare(
          "INSERT INTO monthly_goals(month,revenue_target,profit_target,actual_revenue,actual_profit,closed_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(month) DO UPDATE SET actual_revenue=excluded.actual_revenue,actual_profit=excluded.actual_profit,closed_at=excluded.closed_at WHERE monthly_goals.closed_at IS NULL",
        )
        .bind(
          row.month,
          row.revenue_target,
          row.profit_target,
          result.actual_revenue,
          result.actual_profit,
        )
        .run();
      result.closed_at = date;
    }
    history.push(result);
  }
  return history.sort((a, b) => b.month.localeCompare(a.month));
}
