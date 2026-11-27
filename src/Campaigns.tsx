import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Plus,
  Calculator,
  FileText,
} from "lucide-react";
import {
  type State,
  type Campaign,
  campaignTotals,
  simulate,
  sum,
  assigned,
  stock,
} from "./operations";
import { type Actions, operational, financial } from "./operationActions";
import { Metric, Pill, Section, Empty, count, currency, unit } from "./ui";
export function CampaignCard({
  s,
  c,
  actions: a,
}: {
  s: State;
  c: Campaign;
  actions: Actions;
}) {
  const [files, setFiles] = useState<
      { id: string; name: string; campaign_id: string }[]
    >([]),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const t = campaignTotals(s, c),
    p = simulate(s, c);
  async function loadFiles() {
    try {
      const response = await fetch("/api/operations/attachments");
      if (!response.ok) throw Error("Não foi possível ler os comprovantes.");
      setFiles(
        (
          (await response.json()) as {
            attachments: { id: string; name: string; campaign_id: string }[];
          }
        ).attachments,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <details
      className="campaign"
      onToggle={(e) => {
        if (e.currentTarget.open) void loadFiles();
      }}
    >
      <summary>
        <span className="campaign-symbol">
          <ArrowUpRight size={21} />
        </span>
        <div>
          <strong>{c.name}</strong>
          <small>
            {c.own ? "Operação própria" : c.client} ·{" "}
            {c.performed || c.planned || "Data não informada"}
          </small>
        </div>
        <Pill tone={c.financial === "closed" ? "green" : "amber"}>
          {financial[c.financial]}
        </Pill>
        <span className="campaign-value">
          {currency(t.hasCosts ? t.total : null)}
          <small>subtotal {t.complete ? "apurado" : "parcial"}</small>
        </span>
        <ChevronDown size={18} />
      </summary>
      <div className="campaign-body">
        <div className="toolbar">
          <Pill>{operational[c.operational]}</Pill>
          <button className="text-button" onClick={() => a.editCampaign(c)}>
            Editar campanha
          </button>
          <button className="text-button" onClick={() => a.requirements(c)}>
            Componentes aplicáveis
          </button>
          <button
            className="text-button"
            onClick={() => a.editEntry(undefined, c)}
          >
            Registrar receita/despesa
          </button>
          <button className="text-button" onClick={() => a.allocateRevenue(c)}>
            Distribuir receita entre BMs
          </button>
        </div>
        <div className="metrics compact">
          <Metric label="Enviadas" value={count(c.sent)} />
          <Metric label="Entregues" value={count(c.delivered)} />
          <Metric label="Cobradas (informadas)" value={count(c.billed)} />
          <Metric label="Custo por envio" value={unit(t.sentUnit)} />
          <Metric label="Custo por entrega" value={unit(t.deliveredUnit)} />
        </div>
        <div className="notice">
          {t.pending.length
            ? "Em apuração: " +
              t.pending
                .map(
                  (x) =>
                    ({
                      platform: "Plataforma",
                      meta: "Meta",
                      bm: "BM",
                      profile: "Perfis",
                      chip: "Chips",
                      work: "Trabalho",
                      other: "Outros",
                      shared: "Estrutura",
                    })[x],
                )
                .join(", ")
            : "Custos confirmados."}{" "}
          {c.own && t.revenue === null
            ? "Retorno da operação própria não apurado."
            : ""}
        </div>
        <div className="metrics compact">
          <Metric
            label="Custos diretos"
            value={currency(t.hasCosts ? t.direct : null)}
          />
          <Metric
            label="Compartilhados"
            value={currency(t.hasCosts ? t.shared : null)}
          />
          <Metric
            label="Confirmados / estimados"
            value={
              <>
                {currency(t.confirmed)} / {currency(t.estimated)}
              </>
            }
          />
          <Metric
            label="Resultado gerencial"
            value={t.result === null ? "Não apurado" : currency(t.result)}
            detail={
              t.complete
                ? "Conforme registros disponíveis"
                : "Parcial — não é lucro definitivo"
            }
          />
        </div>
        <div className="toolbar">
          <h3>Custos e recursos</h3>
          <button className="secondary" onClick={() => a.editCost(c)}>
            <Plus size={15} /> Adicionar custo
          </button>
          <button className="text-button" onClick={() => a.estimateShared(c)}>
            Estimar estrutura
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Componente / recurso</th>
                <th>Base / entregas por BM</th>
                <th>Valor</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.costs
                .filter((x) => x.campaignId === c.id)
                .map((x) => (
                  <tr key={x.id}>
                    <td>
                      {
                        {
                          platform: "Plataforma",
                          meta: "Meta",
                          bm: "BM",
                          profile: "Perfil",
                          chip: "Chip",
                          work: "Trabalho",
                          other: "Outros",
                          shared: "Estrutura",
                        }[x.source]
                      }
                      <small>
                        {s.resources.find((r) => r.id === x.resourceId)?.name ||
                          s.accounts.find((a) => a.id === x.walletId)?.name ||
                          x.notes}
                      </small>
                    </td>
                    <td>
                      {x.basis || "Base pendente"}
                      <small>
                        {x.source === "bm"
                          ? "Entregas: " + count(x.delivered)
                          : "Quantidade: " + count(x.quantity)}
                      </small>
                    </td>
                    <td>
                      {currency(x.amount)}
                      {x.budgetAmount !== null &&
                        x.budgetAmount !== undefined && (
                          <small>
                            Orçado: {currency(x.budgetAmount)} · variação:{" "}
                            {currency(
                              x.amount === null
                                ? null
                                : x.amount - x.budgetAmount,
                            )}
                          </small>
                        )}
                    </td>
                    <td>
                      <Pill tone={x.status === "confirmed" ? "green" : "amber"}>
                        {x.status === "confirmed"
                          ? "Confirmado"
                          : x.status === "estimated"
                            ? "Estimado"
                            : "Pendente"}
                      </Pill>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => a.editCost(c, x)}
                      >
                        Ajustar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="simulation">
          <div className="toolbar">
            <div>
              <h3>Precificação nesta campanha</h3>
              <p>
                {p.complete
                  ? "Simulação com custos informados"
                  : "Simulação incompleta — sem preço definitivo"}
              </p>
            </div>
            <button className="secondary" onClick={() => a.price(c)}>
              <Calculator size={16} />
              Simular preço
            </button>
          </div>
          <div className="metrics compact">
            <Metric label="Receita simulada" value={currency(p.revenue)} />
            <Metric
              label="Impostos, taxas e comissões"
              value={currency(p.deductions)}
            />
            <Metric label="Resultado estimado" value={currency(p.result)} />
            <Metric
              label="Margem sobre receita"
              value={
                p.margin === null
                  ? "Não apurada"
                  : (p.margin * 100).toFixed(2) + "%"
              }
            />
          </div>
          <small>
            Referência comercial: {unit(s.settings.commercialReference / 100)}{" "}
            por mensagem.{" "}
            {p.unit !== null && p.unit > s.settings.commercialReference / 100
              ? "Acima da referência comercial. "
              : ""}
            Taxa de operação inclui custos e não equivale a lucro.
          </small>
        </div>
        <h3>Comprovantes e observações</h3>
        <p>{c.notes || "Sem observações."}</p>
        <div className="toolbar">
          {files
            .filter((f) => f.campaign_id === c.id)
            .map((f) => (
              <a
                key={f.id}
                href={"/api/operations/attachments/" + f.id}
                download
              >
                <FileText size={15} />
                {f.name}
              </a>
            ))}
          <label className="upload">
            {uploading ? "Enviando…" : "Anexar PDF ou imagem"}
            <input
              type="file"
              disabled={uploading}
              accept="application/pdf,image/png,image/jpeg"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError("");
                try {
                  const form = new FormData();
                  form.set("campaignId", c.id);
                  form.set("file", file);
                  const result = await fetch("/api/operations/attachments", {
                    method: "POST",
                    body: form,
                  });
                  if (!result.ok)
                    throw Error(
                      ((await result.json()) as { error: string }).error,
                    );
                  await loadFiles();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
export function Resources({ s, actions: a }: { s: State; actions: Actions }) {
  return (
    <details className="auxiliary">
      <summary>
        Cadastros auxiliares · BMs, perfis e chips <ChevronDown size={18} />
      </summary>
      <Section
        title="Recursos da operação"
        actions={
          <button className="secondary" onClick={() => a.editResource()}>
            <Plus size={16} />
            Recurso
          </button>
        }
      >
        <div className="resource-grid">
          {s.resources.map((r) => (
            <div className="resource" key={r.id}>
              <Pill>
                {r.kind === "bm"
                  ? "BM"
                  : r.kind === "profile"
                    ? "Perfil"
                    : "Chips"}
              </Pill>
              <h3>{r.name}</h3>
              <p>
                {r.status === "closed"
                  ? "Encerrado"
                  : r.status === "in_use"
                    ? "Em uso"
                    : "Disponível"}{" "}
                · limite {count(r.limit)}
              </p>
              <div className="summary-row">
                <span>Aquisição</span>
                <strong>{currency(r.amount)}</strong>
              </div>
              <div className="summary-row">
                <span>Atribuído / baixado</span>
                <strong>{currency(assigned(s, r.id))}</strong>
              </div>
              <div className="summary-row">
                <span>Ainda não atribuído</span>
                <strong>
                  {currency(
                    r.amount === null ? null : r.amount - assigned(s, r.id),
                  )}
                </strong>
              </div>
              {r.kind === "chip" && (
                <p>
                  Disponíveis: {stock(s, r)} de {r.quantity}
                </p>
              )}
              <small>{r.policy || "Política de distribuição pendente"}</small>
              {r.recoveredStatement && (
                <div className="notice">
                  Declaração do usuário: {r.recoveredStatement}. Retorno não
                  comprovado pelo sistema.
                </div>
              )}
              <small>
                Receita atribuída:{" "}
                {s.revenueShares.some((x) => x.resourceId === r.id)
                  ? currency(
                      sum(
                        s.revenueShares.filter((x) => x.resourceId === r.id),
                        (x) => x.amount,
                      ),
                    )
                  : "Não apurada"}{" "}
                · resultado parcial:{" "}
                {s.revenueShares.some((x) => x.resourceId === r.id)
                  ? currency(
                      sum(
                        s.revenueShares.filter((x) => x.resourceId === r.id),
                        (x) => x.amount,
                      ) - assigned(s, r.id),
                    )
                  : "Não apurado"}
              </small>
              <small>
                Entregas conhecidas:{" "}
                {s.costs.some(
                  (c) => c.resourceId === r.id && c.delivered !== null,
                )
                  ? sum(
                      s.costs.filter((c) => c.resourceId === r.id),
                      (c) => c.delivered ?? 0,
                    )
                  : "Não informado"}{" "}
                · campanhas:{" "}
                {
                  new Set(
                    s.costs
                      .filter((c) => c.resourceId === r.id)
                      .map((c) => c.campaignId),
                  ).size
                }
              </small>
              <details className="resource-history">
                <summary>Campanhas associadas e resultado atribuído</summary>
                <small>
                  Receita atribuída não comprova recebimento nem recuperação do
                  investimento.
                </small>
                {[
                  ...new Set(
                    s.costs
                      .filter((c) => c.resourceId === r.id)
                      .map((c) => c.campaignId),
                  ),
                ].map((id) => {
                  const campaign = s.campaigns.find((c) => c.id === id)!;
                  const usage = s.costs.filter(
                    (c) => c.resourceId === r.id && c.campaignId === id,
                  );
                  const share = s.revenueShares.find(
                    (x) => x.resourceId === r.id && x.campaignId === id,
                  );
                  const knownCost = sum(
                    usage.filter((c) => c.status === "confirmed"),
                    (c) => c.amount ?? 0,
                  );
                  return (
                    <div className="audit-row" key={id}>
                      <strong>{campaign.name}</strong>
                      <small>
                        Custo confirmado: {currency(knownCost)} · receita
                        atribuída: {currency(share?.amount)} · resultado
                        parcial:{" "}
                        {share
                          ? currency(share.amount - knownCost)
                          : "Não apurado"}
                      </small>
                      <small>
                        {share?.basis || "Receita ainda não distribuída"}
                        {usage.some((c) => c.status !== "confirmed")
                          ? " · custo pendente ou estimado"
                          : ""}
                      </small>
                    </div>
                  );
                })}
              </details>
              <div className="row-actions">
                <button
                  className="text-button"
                  onClick={() => a.editResource(r)}
                >
                  Editar
                </button>
                {r.status !== "closed" && (
                  <button
                    className="text-button"
                    onClick={() => a.closeResource(r)}
                  >
                    Encerrar e tratar saldo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!s.resources.length && (
          <Empty>
            Cadastre separadamente perfis reutilizáveis, BMs e compras de chips.
          </Empty>
        )}
      </Section>
    </details>
  );
}

