import { useEffect, useState } from "react";
import {
  Calculator,
  Save,
  Smartphone,
  MessageSquare,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { calculatePricing, defaultPricing, type PricingInput } from "./pricing";
import { entryAmount, labels, money, type Entry } from "./finance";
export function Pricing({ entries }: { entries: Entry[] }) {
  const [p, setP] = useState<PricingInput>(defaultPricing);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/pricing")
      .then(async (r) => {
        if (!r.ok)
          throw new Error("Não foi possível carregar a simulação salva.");
        const d = (await r.json()) as { input: PricingInput | null };
        if (d.input) {
          calculatePricing(d.input);
          setP(d.input);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const integratedCosts = entries
    .filter(
      (e) =>
        ["bm", "tool", "fixed", "salary", "payroll"].includes(e.kind) &&
        e.status === "paid",
    )
    .reduce((sum, e) => sum + entryAmount(e, entries), 0);
  const integratedByKind = (
    ["bm", "tool", "fixed", "salary", "payroll"] as const
  ).map((kind) => ({
    kind,
    total: entries
      .filter((e) => e.kind === kind && e.status === "paid")
      .reduce((sum, e) => sum + entryAmount(e, entries), 0),
  }));
  let result: ReturnType<typeof calculatePricing> | null = null;
  let validation = "";
  try {
    result = calculatePricing(p, integratedCosts);
  } catch (e) {
    validation = (e as Error).message;
  }
  const field = (
    key: keyof PricingInput,
    label: string,
    options: { currency?: boolean; percent?: boolean; help?: string } = {},
  ) => (
    <label>
      {label}
      <div className="pricing-input">
        {options.currency && <span>R$</span>}
        <input
          type="number"
          inputMode={
            options.currency || options.percent ? "decimal" : "numeric"
          }
          min={0}
          max={options.percent ? 100 : undefined}
          step={options.currency || options.percent ? "0.01" : "1"}
          value={options.currency ? (p[key] as number) / 100 : p[key]}
          onChange={(e) => {
            setP({
              ...p,
              [key]: options.currency
                ? Math.round(Number(e.target.value) * 100)
                : Number(e.target.value),
            });
            setMessage("");
          }}
        />
        {options.percent && <span>%</span>}
      </div>
      {options.help && <small className="field-help">{options.help}</small>}
    </label>
  );
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Não foi possível salvar.");
      setMessage("Simulação salva. Você pode continuar em outro dispositivo.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const unit = (cents: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(cents / 100);
  return (
    <div className="pricing-layout">
      <section className="panel pricing-form">
        <div className="panel-head">
          <div>
            <h2>Monte sua operação</h2>
            <p>Os valores são configuráveis para cada cenário de envio.</p>
          </div>
          <Calculator size={22} />
        </div>
        <div className="pricing-fields">
          {loading ? (
            <p role="status">Carregando simulação…</p>
          ) : (
            <>
              <label>
                Calcular a partir de
                <select
                  value={p.mode}
                  onChange={(e) =>
                    setP({ ...p, mode: e.target.value as PricingInput["mode"] })
                  }
                >
                  <option value="chips">Quantidade de chips</option>
                  <option value="messages">
                    Quantidade de mensagens a entregar
                  </option>
                </select>
              </label>
              <div className="form-grid">
                {p.mode === "chips"
                  ? field("chips", "Quantidade de chips")
                  : field("messages", "Mensagens a entregar")}
                <label>
                  Tipo de BM
                  <select
                    value={
                      [250, 1000, 2000, 10000].includes(p.messagesPerChip)
                        ? p.messagesPerChip
                        : "custom"
                    }
                    onChange={(e) => {
                      if (e.target.value !== "custom")
                        setP({ ...p, messagesPerChip: Number(e.target.value) });
                      else setP({ ...p, messagesPerChip: 500 });
                    }}
                  >
                    <option value={250}>BM 250</option>
                    <option value={1000}>BM 1 mil</option>
                    <option value={2000}>BM 2 mil</option>
                    <option value={10000}>BM 10 mil</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </label>
                {field("messagesPerChip", "Limite de leads por BM", {
                  help: "Limite total da BM no período deste lote, não de cada chip.",
                })}
                {field("chipsPerBm", "Chips necessários por BM")}
                {field("deliveryRate", "Taxa de entrega estimada", {
                  percent: true,
                  help: "Desconta falhas da capacidade útil de cada BM.",
                })}
              </div>
              <h3>Custos por chip</h3>
              <div className="form-grid">
                {field("chipCost", "Compra do chip", { currency: true })}
                {field("activationCost", "Ativação / preparação", {
                  currency: true,
                })}
                {field("rechargeCost", "Recarga / plano", { currency: true })}
                {field("otherPerChip", "Outros custos por chip", {
                  currency: true,
                })}
              </div>
              <h3>Custos do lote e precificação</h3>
              <div className="integrated-costs">
                <strong>Custos já cadastrados no BigCash</strong>
                <span>Incluídos nesta simulação: {money(integratedCosts)}</span>
                <div>
                  {integratedByKind.map((x) => (
                    <small key={x.kind}>
                      {labels[x.kind]}: {money(x.total)}
                    </small>
                  ))}
                </div>
                <em>
                  Farm de BM, ferramentas, despesas fixas e pró-labore pagos são
                  somados automaticamente.
                </em>
              </div>
              {field("bmCost", "Custo adicional por BM", {
                currency: true,
                help: "Custo de preparação ou uso de cada BM, além dos chips.",
              })}
              {field("campaignCost", "Custos extras do lote", {
                currency: true,
                help: "Inclua a parcela de ferramentas, BMs e operação destinada a este lote. Não repita custos já incluídos acima.",
              })}
              <div className="form-grid">
                {field("salesTax", "Taxas sobre a venda", { percent: true })}
                {field("margin", "Margem de lucro desejada", {
                  percent: true,
                  help: "Percentual do preço de venda que fica como lucro.",
                })}
              </div>
              <p className="field-help">
                A capacidade de envio é uma estimativa sua. A ferramenta não
                garante entregas nem altera os limites das plataformas.
              </p>
            </>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="success-note" role="status">
              {message}
            </div>
          )}
          <div className="pricing-actions">
            <button
              className="secondary"
              disabled={loading || saving}
              onClick={() => {
                setP(defaultPricing);
                setMessage("");
              }}
            >
              <RotateCcw size={16} />
              Limpar valores
            </button>
            <button
              className="primary"
              disabled={loading || saving || !!validation}
              onClick={save}
            >
              <Save size={16} />
              {saving ? "Salvando…" : "Salvar simulação"}
            </button>
          </div>
        </div>
      </section>
      <aside className="pricing-result">
        <section className="stat dark">
          <div>
            <span>Preço sugerido do lote</span>
            <Calculator size={20} />
          </div>
          <strong>{result ? money(result.price) : "—"}</strong>
          <small>Para a margem e as taxas informadas</small>
        </section>
        {validation ? (
          <div className="error" role="alert">
            {validation}
          </div>
        ) : (
          result && (
            <>
              <section className="panel">
                <div className="panel-head">
                  <h2>Seu preço, em detalhes</h2>
                </div>
                <dl className="price-breakdown">
                  <div>
                    <dt>BMs necessárias</dt>
                    <dd>{result.bms.toLocaleString("pt-BR")}</dd>
                  </div>
                  <div>
                    <dt>
                      <Smartphone size={16} />
                      Chips necessários
                    </dt>
                    <dd>{result.chips.toLocaleString("pt-BR")}</dd>
                  </div>
                  <div>
                    <dt>
                      <MessageSquare size={16} />
                      Mensagens do lote
                    </dt>
                    <dd>{result.messages.toLocaleString("pt-BR")}</dd>
                  </div>
                  <div>
                    <dt>Capacidade útil por BM</dt>
                    <dd>{result.usablePerChip.toLocaleString("pt-BR")}</dd>
                  </div>
                  <div>
                    <dt>Capacidade excedente</dt>
                    <dd>{result.spare.toLocaleString("pt-BR")}</dd>
                  </div>
                  <div>
                    <dt>Custo por mensagem</dt>
                    <dd>{unit(result.unitCost)}</dd>
                  </div>
                  <div className="highlight">
                    <dt>Preço por mensagem</dt>
                    <dd>
                      {unit(result.unitPrice)}{" "}
                      <small>
                        ({result.unitPrice.toFixed(2).replace(".", ",")}{" "}
                        centavos)
                      </small>
                    </dd>
                  </div>
                  <div className="highlight">
                    <dt>Preço médio por chip</dt>
                    <dd>{money(Math.ceil(result.chipPrice))}</dd>
                  </div>
                  <div>
                    <dt>Custo total</dt>
                    <dd>{money(result.cost)}</dd>
                  </div>
                  <div>
                    <dt>Custos integrados</dt>
                    <dd>{money(integratedCosts)}</dd>
                  </div>
                  <div>
                    <dt>Taxas estimadas</dt>
                    <dd>{money(result.tax)}</dd>
                  </div>
                  <div className="highlight">
                    <dt>Lucro estimado</dt>
                    <dd>{money(result.profit)}</dd>
                  </div>
                </dl>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Compare os limites de BM</h2>
                    <p>Mesmo volume de leads e custos informados.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>BM</th>
                        <th>BMs</th>
                        <th>Chips</th>
                        <th>Preço do lote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[250, 1000, 2000, 10000].map((limit) => {
                        let alt;
                        try {
                          alt = calculatePricing(
                            {
                              ...p,
                              mode: "messages",
                              messages: result.messages,
                              messagesPerChip: limit,
                            },
                            integratedCosts,
                          );
                        } catch {
                          return (
                            <tr key={limit}>
                              <td>{limit}</td>
                              <td colSpan={3}>Capacidade insuficiente</td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={limit}>
                            <td>{limit.toLocaleString("pt-BR")}</td>
                            <td>{alt.bms}</td>
                            <td>{alt.chips}</td>
                            <td>{money(alt.price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="field-help comparison-note">
                  Simulações alternativas, sem combinar tipos de BM no mesmo
                  lote. Custos de BM maiores podem ser diferentes: ajuste ao
                  selecionar o cenário.
                </p>
              </section>
              <div className="pricing-explanation">
                <ArrowRight size={18} />
                <p>
                  <strong>Margem sobre a venda</strong>
                  <br />
                  Preço = custo total ÷ (1 − margem − taxas). O custo total
                  inclui BM, ferramentas, despesas fixas e pró-labore pagos. Os
                  chips são arredondados para cima; a capacidade útil, para
                  baixo. Valores unitários são médias arredondadas; use o preço
                  do lote ao fechar a proposta.
                </p>
              </div>
              {result.cost === 0 && (
                <div className="info-note">
                  Preencha seus custos reais para obter uma sugestão de preço.
                </div>
              )}
            </>
          )
        )}
      </aside>
    </div>
  );
}
