import React, { useEffect, useState } from "react";
import { money, displayDate } from "./finance";

export function Goals({
  from,
  to,
  income,
  profit,
}: {
  from: string;
  to: string;
  income: number;
  profit: number;
}) {
  const [targets, setTargets] = useState({ revenue: "", profit: "" });
  const [saved, setSaved] = useState({ revenue: 0, profit: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setMessage("");
    fetch(`/api/goals?from=${from}&to=${to}`, { signal: controller.signal })
      .then(async (r) => {
        const d = (await r.json()) as {
          revenue: number;
          profit: number;
          error?: string;
        };
        if (!r.ok) throw Error(d.error);
        return d;
      })
      .then((d) => {
        setSaved(d);
        setTargets({
          revenue: d.revenue ? String(d.revenue / 100) : "",
          profit: d.profit ? String(d.profit / 100) : "",
        });
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message || "Não foi possível carregar as metas.");
        }
      });
    return () => controller.abort();
  }, [from, to]);
  return (
    <section className="panel goals-panel">
      <h2>Metas de faturamento e lucro</h2>
      <p>
        {displayDate(from)} a {displayDate(to)} · Metas exclusivas deste
        período.
      </p>
      <p>
        Lucro realizado = receitas recebidas − despesas pagas, incluindo taxas,
        folha salarial e pró-labore. Pró-labore é despesa, não lucro. Pendências
        e saldo inicial não entram neste resultado.
      </p>
      <div className="goals-grid">
        {(
          [
            { key: "revenue", title: "Faturamento recebido", actual: income },
            { key: "profit", title: "Lucro realizado", actual: profit },
          ] as const
        ).map((item) => {
          const target = saved[item.key];
          const percent = target > 0 ? (item.actual / target) * 100 : 0;
          return (
            <div key={item.key} className="goal-card">
              <h3>{item.title}</h3>
              <strong>{money(item.actual)}</strong>
              <p>
                {loading
                  ? "Carregando meta…"
                  : target
                    ? `Meta: ${money(target)} · ${percent.toFixed(1).replace(".", ",")}% atingido`
                    : "Meta ainda não definida"}
              </p>
              <progress
                aria-label={`Progresso de ${item.title}`}
                max={100}
                value={Math.max(0, Math.min(100, percent))}
              />
              {!loading && target > 0 && (
                <p>
                  {item.actual >= target
                    ? "Meta atingida!"
                    : `Faltam ${money(target - item.actual)}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <form
        className="goals-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          const values = {
            revenue: Math.round(Number(targets.revenue) * 100),
            profit: Math.round(Number(targets.profit) * 100),
          };
          try {
            const r = await fetch("/api/goals", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ from, to, ...values }),
            });
            const d = (await r.json()) as {
              revenue: number;
              profit: number;
              error?: string;
            };
            if (!r.ok) throw Error(d.error);
            setSaved(values);
            setMessage("Metas salvas.");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Não foi possível salvar.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {(["revenue", "profit"] as const).map((key) => (
          <label key={key}>
            {key === "revenue"
              ? "Meta de faturamento (R$)"
              : "Meta de lucro (R$)"}
            <input
              type="number"
              min="0"
              max="1000000000"
              step="0.01"
              placeholder="0,00"
              disabled={loading || busy}
              value={targets[key]}
              onChange={(e) =>
                setTargets({ ...targets, [key]: e.target.value })
              }
            />
          </label>
        ))}
        <button className="primary" disabled={loading || busy}>
          {busy ? "Salvando…" : "Salvar metas"}
        </button>
      </form>
      <p>
        Deixe em branco ou informe zero para remover uma meta deste período.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
