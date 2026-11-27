import { useState } from "react";
import { Download } from "lucide-react";
import { movements, type Entry as LegacyEntry } from "./finance";
import { type State, type Rate, budgetStructure, sum, dre } from "./operations";
import {
  type Editor,
  Section,
  Metric,
  Pill,
  currency,
  count,
  select,
} from "./ui";
import { type Actions } from "./operationActions";
import { api } from "./StatementsPage";
export function SettingsPage({
  s,
  legacy,
  legacyOpening,
  from,
  to,
  open,
  save,
  actions: a,
}: {
  s: State;
  legacy: LegacyEntry[];
  legacyOpening: number | null;
  from: string;
  to: string;
  open: (e: Editor) => void;
  save: (s: State, reason: string) => Promise<void>;
  actions: Actions;
}) {
  const [history, setHistory] = useState<
      { version: number; reason: string; actor: string; created_at: string }[]
    >([]),
    [error, setError] = useState("");
  const result = dre(s, from, to),
    expenses = result.expenses + result.consumption + result.writeOff;
  return (
    <>
      <Section title="Referências da operação e vigência">
        <div className="notice">
          Valores fornecidos por você, usados como referências de orçamento. Não
          criam compras, saldos ou pagamentos. Confirme periodicidade e vigência
          antes de gerar títulos mensais.
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referência</th>
                <th>Valor unitário</th>
                <th>Quantidade</th>
                <th>Periodicidade / vigência</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.settings.rates.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{currency(r.amount)}</td>
                  <td>{r.quantity}</td>
                  <td>
                    {r.periodicity === "unconfirmed"
                      ? "A confirmar"
                      : r.periodicity === "monthly"
                        ? "Mensal"
                        : "Aquisição única"}
                    <small>{r.effective || "Vigência não informada"}</small>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() =>
                        open({
                          title: "Editar referência",
                          fields: [
                            {
                              name: "name",
                              label: "Nome",
                              value: r.name,
                              required: true,
                            },
                            {
                              name: "amount",
                              label: "Valor unitário (R$)",
                              type: "money",
                              value: r.amount,
                              required: true,
                            },
                            {
                              name: "quantity",
                              label: "Quantidade",
                              type: "number",
                              value: r.quantity,
                              required: true,
                            },
                            {
                              name: "effective",
                              label: "Início de vigência",
                              type: "date",
                              value: r.effective,
                            },
                            select(
                              "periodicity",
                              "Periodicidade",
                              r.periodicity,
                              {
                                unconfirmed: "Não confirmada",
                                monthly: "Mensal",
                                once: "Única",
                              },
                            ),
                            {
                              name: "confirmed",
                              label: "Periodicidade e valores conferidos",
                              type: "checkbox",
                              value: r.confirmed,
                            },
                          ],
                          save: async (v) =>
                            save(
                              {
                                ...s,
                                settings: {
                                  ...s.settings,
                                  rates: s.settings.rates.map((x) =>
                                    x.id === r.id
                                      ? ({
                                          ...v,
                                          id: r.id,
                                          effective: v.effective || null,
                                        } as Rate)
                                      : x,
                                  ),
                                },
                              },
                              "Referência: " + r.name,
                            ),
                        })
                      }
                    >
                      Editar
                    </button>
                    {r.confirmed && r.periodicity === "monthly" && (
                      <button
                        className="text-button"
                        onClick={() =>
                          open({
                            title: "Gerar título mensal",
                            description:
                              "Gera um título pendente apenas no mês informado. O mesmo item/mês não é gerado duas vezes; nenhum pagamento é presumido.",
                            fields: [
                              {
                                name: "competence",
                                label: "Competência do mês",
                                type: "date",
                                required: true,
                              },
                              {
                                name: "due",
                                label: "Vencimento",
                                type: "date",
                                required: true,
                              },
                            ],
                            save: async (v) => {
                              if (String(v.competence) < r.effective!)
                                throw Error("Competência anterior à vigência.");
                              const id =
                                "recurring:" +
                                r.id +
                                ":" +
                                String(v.competence).slice(0, 7);
                              if (s.entries.some((e) => e.id === id))
                                throw Error("Título desse mês já existe.");
                              await save(
                                a.patch("entries", {
                                  id,
                                  name: r.name,
                                  kind: "expense",
                                  amount: r.amount * r.quantity,
                                  competence: String(v.competence),
                                  due: String(v.due),
                                  campaignId: "",
                                  client: "",
                                  shared: true,
                                  category: "Estrutura",
                                  notes: "Referência confirmada: " + r.id,
                                  legacyKey: "",
                                }),
                                "Título mensal: " + r.name,
                              );
                            },
                          })
                        }
                      >
                        Gerar mês
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Orçamento e reserva">
        <div className="metrics compact">
          <Metric
            label="Estrutura de referência"
            value={currency(budgetStructure(s, null))}
          />
          <Metric
            label="Volume mensal"
            value={count(s.settings.budgetVolume)}
          />
          <Metric
            label="Estrutura por mil"
            value={currency(
              Math.round(
                (budgetStructure(s, null) * 1000) / s.settings.budgetVolume,
              ),
            )}
          />
          <Metric
            label="Cobertura da reserva"
            value={
              expenses > 0
                ? (
                    sum(s.accounts, (a) => a.reserve) /
                    ((expenses /
                      Math.max(
                        1,
                        (Date.parse(to) - Date.parse(from)) / 86400000 + 1,
                      )) *
                      30)
                  ).toFixed(1) + " meses"
                : "Não apurada"
            }
            detail={`Meta ${s.settings.reserveMonths} meses · despesas conhecidas do período`}
          />
        </div>
        <button
          className="secondary"
          onClick={() =>
            open({
              title: "Orçamento e metas de reserva",
              description:
                "A reserva está dentro dos saldos. Metas não recomendam retiradas ou investimentos.",
              fields: [
                {
                  name: "budgetVolume",
                  label: "Volume mensal de orçamento",
                  type: "number",
                  value: s.settings.budgetVolume,
                  required: true,
                },
                {
                  name: "reference",
                  label: "Referência comercial por mensagem (R$)",
                  type: "decimal",
                  value: s.settings.commercialReference / 10000,
                  required: true,
                },
                {
                  name: "reserveTarget",
                  label: "Meta de reserva (R$)",
                  type: "money",
                  value: s.settings.reserveTarget,
                },
                {
                  name: "reserveMonths",
                  label: "Meta de cobertura (meses)",
                  type: "number",
                  value: s.settings.reserveMonths,
                },
              ],
              save: async (v) =>
                save(
                  {
                    ...s,
                    settings: {
                      ...s.settings,
                      budgetVolume: Number(v.budgetVolume),
                      commercialReference: Math.round(
                        Number(v.reference) * 10000,
                      ),
                      reserveTarget: Number(v.reserveTarget ?? 0),
                      reserveMonths: Number(v.reserveMonths ?? 0),
                    },
                  },
                  "Metas e orçamento",
                ),
            })
          }
        >
          Editar parâmetros
        </button>
      </Section>
      <Section title="Histórico anterior preservado">
        <p>
          {legacy.length} cadastro(s) legado(s). Saldo inicial antigo:{" "}
          {currency(legacyOpening)} — origem e data precisam ser verificadas
          antes de atribuir a uma conta.
        </p>
        <div className="notice">
          O histórico não foi apagado nem somado automaticamente ao novo modelo.
          Confira cada ocorrência: a versão antiga replicava o mesmo estado de
          pagamento na recorrência. Conversão cria um título; confirme a
          liquidação separadamente. Use o período da tela para consultar outras
          datas.
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Registro</th>
                <th>Data original</th>
                <th>Valor</th>
                <th>Tratamento</th>
              </tr>
            </thead>
            <tbody>
              {movements(legacy, from, to).map((e, i) => {
                const key = e.sourceId + "|" + e.id + "|" + e.occurrence;
                return (
                  <tr key={key + i}>
                    <td>
                      {e.name}
                      <small>
                        {e.status === "paid"
                          ? "Marcado como pago no legado"
                          : "Pendente no legado"}
                        {e.recurring ? " · recorrência antiga" : ""}
                      </small>
                    </td>
                    <td>{e.occurrence}</td>
                    <td>{currency(e.total)}</td>
                    <td>
                      {s.entries.some((x) => x.legacyKey === key) ? (
                        <Pill tone="green">Convertido</Pill>
                      ) : (
                        <button
                          className="text-button"
                          onClick={() =>
                            a.editEntry({
                              id: "",
                              name: e.name,
                              kind: e.kind === "income" ? "income" : "expense",
                              amount: e.total,
                              competence: e.occurrence,
                              due: e.occurrence,
                              campaignId: "",
                              client: "",
                              shared: false,
                              category: e.category,
                              notes:
                                "Conferir datas e liquidação do legado. " +
                                e.notes,
                              legacyKey: key,
                            })
                          }
                        >
                          Conferir e converter
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Auditoria e exportação">
        <div className="toolbar">
          <button
            className="secondary"
            onClick={async () => {
              try {
                setHistory((await api("operations/audit")).history);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Consultar últimas 100 alterações
          </button>
          <a
            className="button secondary"
            href="/api/operations/export"
            download="bigcash-consulta.json"
          >
            <Download size={16} />
            Exportar para consulta
          </a>
        </div>
        <p className="muted">
          Backup completo e restauração usam o D1, incluindo anexos e tabelas
          históricas. A exportação de consulta não substitui backup.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {history.map((h) => (
          <div className="audit-row" key={h.version}>
            <strong>
              v{h.version} · {h.reason}
            </strong>
            <small>
              {h.created_at} · {h.actor}
            </small>
          </div>
        ))}
      </Section>
      <Section title="Integrações">
        <p>
          Cloudflare D1: persistência do projeto. OFX/CSV: importação manual
          disponível.
        </p>
        <p>
          Conexões bancárias diretas, Open Finance, Meta e plataformas: nenhuma
          conexão ativa configurada. Dependem dos bancos e fornecedores usados,
          acesso às APIs oficiais, credenciais no servidor e eventual
          contratação.
        </p>
        <p>
          Não há pagamentos, saques ou mensagens a clientes automatizados. Notas
          fiscais não fazem parte desta navegação.
        </p>
      </Section>
    </>
  );
}

