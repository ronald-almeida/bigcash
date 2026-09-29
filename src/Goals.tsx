import React, { useEffect, useState } from "react";
import { money, today } from "./finance";
import { goalStatus, type MonthlyGoal } from "./monthly";
const monthLabel = (month: string) =>
  new Date(month + "-01T12:00:00Z").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
export function Goals() {
  const current = today().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [months, setMonths] = useState<MonthlyGoal[]>([]);
  const [revenue, setRevenue] = useState("");
  const [profit, setProfit] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async (signal?: AbortSignal) => {
    const r = await fetch("/api/monthly-goals", { signal });
    const d = (await r.json()) as { months: MonthlyGoal[]; error?: string };
    if (!r.ok) throw Error(d.error || "Não foi possível carregar as metas.");
    setMonths(d.months);
    setLoading(false);
  };
  useEffect(() => {
    const c = new AbortController();
    load(c.signal).catch((e) => {
      if (!c.signal.aborted) {
        setError(e.message);
        setLoading(false);
      }
    });
    return () => c.abort();
  }, []);
  useEffect(() => {
    const row = months.find((r) => r.month === month);
    setRevenue(row?.revenue_target ? String(row.revenue_target / 100) : "");
    setProfit(row?.profit_target ? String(row.profit_target / 100) : "");
  }, [month, months]);
  const selected = months.find((r) => r.month === month);
  return (
    <>
      <section className="panel goals-panel">
        <h2>Planejamento mensal</h2>
        <p>
          Cadastre as metas de faturamento e lucro de cada mês. O lucro desconta
          todas as despesas pagas, incluindo pró-labore, folha e impostos.
          Receitas pendentes e saldo inicial não são lucro.
        </p>
        <form
          className="goals-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const r = await fetch("/api/monthly-goals", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  month,
                  revenue_target: Math.round(Number(revenue) * 100),
                  profit_target: Math.round(Number(profit) * 100),
                }),
              });
              const d = (await r.json()) as { error?: string };
              if (!r.ok) throw Error(d.error);
              await load();
              setMessage("Metas do mês salvas.");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Não foi possível salvar.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Mês da meta
            <input
              aria-label="Mês da meta"
              type="month"
              required
              min="2000-01"
              max="2100-12"
              value={month}
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) {
                  setMonth(e.target.value);
                  setMessage("");
                }
              }}
            />
          </label>
          <label>
            Meta de faturamento (R$)
            <input
              type="number"
              min="0"
              max="1000000000"
              step="0.01"
              placeholder="0,00"
              value={revenue}
              disabled={busy || loading || month < current}
              onChange={(e) => setRevenue(e.target.value)}
            />
          </label>
          <label>
            Meta de lucro (R$)
            <input
              type="number"
              min="0"
              max="1000000000"
              step="0.01"
              placeholder="0,00"
              value={profit}
              disabled={busy || loading || month < current}
              onChange={(e) => setProfit(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || loading || month < current}
          >
            {busy ? "Salvando…" : "Salvar metas do mês"}
          </button>
        </form>
        <p>
          {month < current
            ? "Mês encerrado: metas e resultados preservados no histórico."
            : "Informe zero ou deixe vazio para ficar sem meta naquele indicador."}
        </p>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <div className="goals-grid">
          {[
            {
              title: "Faturamento",
              target: selected?.revenue_target ?? 0,
              actual: selected?.actual_revenue ?? 0,
            },
            {
              title: "Lucro",
              target: selected?.profit_target ?? 0,
              actual: selected?.actual_profit ?? 0,
            },
          ].map((i) => (
            <div className="goal-card" key={i.title}>
              <h3>
                {i.title} · {monthLabel(month)}
              </h3>
              <strong>{money(i.actual)}</strong>
              <p>
                Meta: {i.target ? money(i.target) : "Não definida"} ·{" "}
                {goalStatus(i.target, i.actual, month, current)}
              </p>
              <progress
                aria-label={`Progresso de ${i.title}`}
                max={100}
                value={
                  i.target
                    ? Math.max(0, Math.min(100, (i.actual / i.target) * 100))
                    : 0
                }
              />
              {i.target > 0 && (
                <p>
                  {((i.actual / i.target) * 100).toFixed(1).replace(".", ",")}%
                  atingido ·{" "}
                  {i.actual >= i.target
                    ? "Meta atingida"
                    : `Faltam ${money(i.target - i.actual)}`}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="panel goals-panel">
        <h2>Histórico mensal</h2>
        <p>
          O mês atual fica em andamento. Ao virar o mês, o resultado é salvo
          automaticamente e não muda com alterações posteriores nos lançamentos.
          Meses anteriores à implantação são calculados com os lançamentos
          disponíveis hoje.
        </p>
        {loading ? (
          <p>Carregando histórico…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Meta de faturamento</th>
                  <th>Faturamento</th>
                  <th>Situação</th>
                  <th>Meta de lucro</th>
                  <th>Lucro</th>
                  <th>Situação</th>
                  <th>Fechamento</th>
                </tr>
              </thead>
              <tbody>
                {months.map((r) => (
                  <tr key={r.month}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setMonth(r.month)}
                      >
                        {monthLabel(r.month)}
                      </button>
                    </td>
                    <td>
                      {r.revenue_target ? money(r.revenue_target) : "Sem meta"}
                    </td>
                    <td>{money(r.actual_revenue)}</td>
                    <td>
                      {goalStatus(
                        r.revenue_target,
                        r.actual_revenue,
                        r.month,
                        current,
                      )}
                    </td>
                    <td>
                      {r.profit_target ? money(r.profit_target) : "Sem meta"}
                    </td>
                    <td>{money(r.actual_profit)}</td>
                    <td>
                      {goalStatus(
                        r.profit_target,
                        r.actual_profit,
                        r.month,
                        current,
                      )}
                    </td>
                    <td>
                      {r.closed_at
                        ? "Encerrado"
                        : r.month > current
                          ? "Planejado"
                          : "Em andamento"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
