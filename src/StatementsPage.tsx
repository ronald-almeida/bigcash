import { useState } from "react";
import { type State, inPeriod, sum } from "./operations";
import { type Editor, Section, Empty, currency, options } from "./ui";
import { uid } from "./operationActions";
export async function api(path = "", method = "GET", body?: unknown) {
  const response = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as Record<string, any>;
  if (!response.ok) throw Error(data.error || "Não foi possível concluir.");
  return data;
}
export function StatementsPage({
  state: s,
  from,
  to,
  accountFilter,
  busy,
  run,
  open,
  save,
  imported,
  version,
}: {
  state: State;
  from: string;
  to: string;
  accountFilter: string;
  busy: boolean;
  run: (f: () => Promise<void>) => Promise<void>;
  open: (ed: Editor) => void;
  save: (s: State, reason: string) => Promise<void>;
  imported: (result: object) => void;
  version: number;
}) {
  const [account, setAccount] = useState(accountFilter),
    [file, setFile] = useState<File | null>(null);
  const rows = s.statements.filter(
    (r) =>
      (!accountFilter || r.accountId === accountFilter) &&
      inPeriod(r.date, from, to),
  );
  return (
    <>
      <Section title="Importar extrato bancário">
        <p className="muted">
          OFX ou CSV em BRL, até 2 MB. CSV: data, valor, descricao e id
          opcional. Saídas usam valor negativo. Sem ID, a duplicidade é inferida
          por data, valor, descrição e ocorrência; confira os casos ambíguos no
          extrato original.
        </p>
        <div className="toolbar">
          <label>
            Conta bancária
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">Selecione</option>
              {s.accounts
                .filter((a) => a.kind === "bank")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Arquivo
            <input
              type="file"
              accept=".csv,.ofx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            disabled={!file || !account || busy}
            onClick={() =>
              void run(async () => {
                if (!file) return;
                if (file.size > 2000000) throw Error("Limite de 2 MB.");
                const raw = await file.text();
                imported(
                  await api("operations/import", "POST", {
                    accountId: account,
                    name: file.name,
                    raw,
                    version,
                    requestId: uid(),
                  }),
                );
              })
            }
          >
            Importar extrato
          </button>
        </div>
      </Section>
      <Section title="Conciliação">
        <div className="notice">
          Importar não gera receita ou despesa. Vincule aos pagamentos e
          recebimentos registrados em Lançamentos. Tarifas exigem uma despesa
          própria; estornos e transferências preservam os originais.
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data / identificação</th>
                <th>Descrição original</th>
                <th>Valor</th>
                <th>Não conciliado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.date}
                    <small>{row.externalId || "Sem ID bancário"}</small>
                  </td>
                  <td>
                    {row.memo}
                    <small>
                      {s.accounts.find((a) => a.id === row.accountId)?.name}
                    </small>
                  </td>
                  <td>{currency(row.amount)}</td>
                  <td>
                    {currency(
                      Math.abs(row.amount) - sum(row.matches, (m) => m.amount),
                    )}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() =>
                        open({
                          title: "Conciliar movimento",
                          description:
                            "Os vínculos podem ser parciais. Valores, sinais e duplicação são validados no servidor.",
                          fields: [
                            {
                              name: "settlementId",
                              label: "Movimentação existente",
                              type: "select",
                              options: options(
                                s.settlements
                                  .filter(
                                    (m) =>
                                      m.accountId === row.accountId ||
                                      m.targetId === row.accountId,
                                  )
                                  .map((m) => ({
                                    id: m.id,
                                    name: `${m.date} · ${currency(m.amount)} · ${m.notes || m.kind}`,
                                  })),
                                "Selecione",
                              ),
                              required: true,
                            },
                            {
                              name: "amount",
                              label: "Valor a conciliar (R$)",
                              type: "money",
                              value:
                                Math.abs(row.amount) -
                                sum(row.matches, (m) => m.amount),
                              required: true,
                            },
                          ],
                          save: async (v) =>
                            save(
                              {
                                ...s,
                                statements: s.statements.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        matches: [
                                          ...r.matches,
                                          {
                                            settlementId: String(
                                              v.settlementId,
                                            ),
                                            amount: Number(v.amount),
                                          },
                                        ],
                                      }
                                    : r,
                                ),
                              },
                              "Conciliação: " + row.memo,
                            ),
                        })
                      }
                    >
                      Vincular
                    </button>
                    {row.matches.length > 0 && (
                      <button
                        className="text-button"
                        onClick={() =>
                          open({
                            title: "Corrigir conciliação",
                            description:
                              "Remove vínculos de conciliação, mantendo extrato e lançamentos.",
                            fields: [
                              {
                                name: "reason",
                                label: "Motivo",
                                type: "textarea",
                                required: true,
                              },
                            ],
                            save: async (v) =>
                              save(
                                {
                                  ...s,
                                  statements: s.statements.map((r) =>
                                    r.id === row.id ? { ...r, matches: [] } : r,
                                  ),
                                },
                                "Revisão da conciliação: " + v.reason,
                              ),
                          })
                        }
                      >
                        Revisar vínculos
                      </button>
                    )}
                    <details>
                      <summary>Original</summary>
                      <pre>{row.raw}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty>Importe um extrato para iniciar a conciliação.</Empty>
          )}
        </div>
      </Section>
    </>
  );
}

