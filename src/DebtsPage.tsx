import { useState } from "react";
import { money, today, displayDate, labels, type Entry } from "./finance";
import { overdueDebts } from "./debts";
export function Debts({
  entries,
  onEdit,
  onAdd,
}: {
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState("");
  const debts = overdueDebts(entries, today());
  const visible = debts.filter((e) =>
    (e.name + " " + e.category)
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <div className="goals-grid">
        <div className="panel goals-panel">
          <h2>Total em atraso</h2>
          <strong>{money(debts.reduce((s, e) => s + e.total, 0))}</strong>
          <p>{debts.length} vencimento(s) pendente(s)</p>
        </div>
        <div className="panel goals-panel">
          <h2>Maior atraso</h2>
          <strong>{debts[0]?.daysLate ?? 0} dias</strong>
          <p>Somente despesas vencidas antes de hoje</p>
        </div>
      </div>
      <section className="panel goals-panel">
        <div className="panel-head">
          <div>
            <h2>Dívidas atrasadas</h2>
            <p>
              Despesas pendentes vencidas aparecem aqui automaticamente.
              Receitas a receber ficam na área de receitas.
            </p>
          </div>
          <button className="primary" onClick={onAdd}>
            Adicionar dívida
          </button>
        </div>
        <label>
          Buscar dívida
          <input
            aria-label="Buscar dívida"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Descrição ou categoria"
          />
        </label>
        <p>
          Para registrar um pagamento, abra o lançamento e altere a situação
          para pago. Nas despesas recorrentes, a situação atual vale para toda a
          série; confira antes de alterar.
        </p>
        {visible.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Vencimento</th>
                  <th>Atraso</th>
                  <th>Valor</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id + e.occurrence}>
                    <td>
                      {e.name}
                      {e.recurring && <small> · Recorrente</small>}
                    </td>
                    <td>{labels[e.kind]}</td>
                    <td>{displayDate(e.occurrence)}</td>
                    <td>{e.daysLate} dias</td>
                    <td>{money(e.total)}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          const original = entries.find(
                            (x) => x.id === e.sourceId,
                          );
                          if (original) onEdit(original);
                        }}
                      >
                        Abrir lançamento
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h3>
              {query ? "Nenhuma dívida encontrada" : "Nenhuma dívida em atraso"}
            </h3>
            <p>
              Cadastre uma despesa como pendente e informe seu vencimento para
              acompanhá-la aqui.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
