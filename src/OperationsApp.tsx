import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  ListChecks,
  ArrowDownLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  Calculator,
  Settings,
  LogOut,
  Menu,
  Plus,
  ChevronDown,
  Layers,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { today, type Entry as LegacyEntry } from "./finance";
import {
  type State,
  type Entry,
  accountBalance,
  campaignTotals,
  outstanding,
  sum,
  dre,
  forecast,
  inPeriod,
} from "./operations";
import {
  Dialog,
  type Editor,
  Metric,
  Empty,
  Section,
  currency,
  count,
  unit,
} from "./ui";
import { uid, operationActions } from "./operationActions";
import { CampaignCard, Resources } from "./Campaigns";
import { api, StatementsPage } from "./StatementsPage";
import { SettingsPage } from "./SettingsPage";
import "./operations.css";
type Data = {
  version: number;
  state: State;
  legacy: LegacyEntry[];
  legacyOpening: number | null;
};
const navigation = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["entries", "Lançamentos", ListChecks],
  ["statements", "Extrato e conciliação", ArrowLeftRight],
  ["accounts", "Contas e carteiras", Landmark],
  ["payables", "Contas a pagar", ArrowUpRight],
  ["receivables", "Contas a receber", ArrowDownLeft],
  ["cashflow", "Fluxo de caixa", ChartNoAxesCombined],
  ["dre", "DRE gerencial", Calculator],
  ["position", "Posição patrimonial", Layers],
  ["settings", "Configurações", Settings],
] as const;
export default function OperationsApp() {
  const [data, setData] = useState<Data | null>(null),
    [auth, setAuth] = useState<"loading" | "login" | "ready">("loading"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState("dashboard"),
    [mobile, setMobile] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null);
  const [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today()),
    [accountFilter, setAccountFilter] = useState(""),
    [clientFilter, setClientFilter] = useState(""),
    [scope, setScope] = useState("all");
  async function load() {
    const result = await api("operations");
    setData(result as Data);
    setAuth("ready");
  }
  useEffect(() => {
    let live = true;
    api("operations")
      .then((d) => {
        if (live) {
          setData(d as Data);
          setAuth("ready");
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setAuth("login");
        }
      });
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  async function save(state: State, reason: string) {
    if (!data) throw Error("Dados ainda não carregados.");
    const result = await api("operations", "PUT", {
      version: data.version,
      requestId: uid(),
      reason,
      state,
    });
    setData({ ...data, ...result });
    setNotice("Alteração salva e registrada no histórico.");
    setError("");
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (auth === "loading")
    return <div className="loading">Carregando seu financeiro…</div>;
  if (auth === "login")
    return (
      <main className="login">
        <div className="brand">
          <span>B</span>bigcash<span className="brand-dot">.</span>
        </div>
        <h1>Clareza para cada decisão.</h1>
        <p>Acesse o controle financeiro da sua operação.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const password = String(
              new FormData(e.currentTarget).get("password"),
            );
            void run(async () => {
              await api("login", "POST", { password });
              await load();
            });
          }}
        >
          <label>
            Senha de acesso
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Entrando…" : "Entrar no BigCash"}
          </button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <small>
          <ShieldCheck size={15} /> Sessão protegida · Dados no servidor
        </small>
      </main>
    );
  const s = data!.state,
    a = operationActions(s, save, setEditor, from, to),
    currentDay = today();
  const campaigns = s.campaigns.filter(
    (c) =>
      (!clientFilter || c.client === clientFilter) &&
      (scope === "all" || c.own === (scope === "own")) &&
      (!accountFilter ||
        s.costs.some(
          (x) => x.campaignId === c.id && x.walletId === accountFilter,
        ) ||
        s.entries.some(
          (e) =>
            e.campaignId === c.id &&
            s.settlements.some(
              (m) =>
                m.entryId === e.id &&
                (m.accountId === accountFilter || m.targetId === accountFilter),
            ),
        )),
  );
  const ids = new Set(campaigns.map((c) => c.id));
  const entries = s.entries.filter(
    (e) =>
      (!clientFilter || e.client === clientFilter || ids.has(e.campaignId)) &&
      (scope === "all" || ids.has(e.campaignId)) &&
      (!accountFilter ||
        s.settlements.some(
          (m) =>
            m.entryId === e.id &&
            (m.accountId === accountFilter || m.targetId === accountFilter),
        )),
  );
  const selected: State = {
    ...s,
    entries,
    campaigns,
    costs: s.costs.filter((c) => ids.has(c.campaignId)),
    settlements: s.settlements.filter(
      (m) =>
        (!accountFilter ||
          m.accountId === accountFilter ||
          m.targetId === accountFilter) &&
        ((!clientFilter && scope === "all") ||
          entries.some((e) => e.id === m.entryId)),
    ),
  };
  const accounts = s.accounts.filter(
      (a) => !accountFilter || a.id === accountFilter,
    ),
    balances = accounts.map((a) => ({ a, balance: accountBalance(s, a, to) }));
  const bankTotal = sum(
      balances.filter((x) => x.a.kind === "bank"),
      (x) => x.balance ?? 0,
    ),
    walletTotal = sum(
      balances.filter((x) => x.a.kind === "wallet"),
      (x) => x.balance ?? 0,
    ),
    unknownBalances = balances.filter((x) => x.balance === null).length;
  const ledger = dre(
      selected,
      from,
      to,
      clientFilter || scope !== "all" ? ids : undefined,
      new Set(entries.map((e) => e.id)),
    ),
    cash = forecast(selected, from, to, currentDay),
    periodCampaigns = campaigns.filter((c) =>
      inPeriod(c.performed || c.planned, from, to),
    ),
    totals = periodCampaigns.map((c) => ({ c, t: campaignTotals(s, c) }));
  const totalCosts = sum(totals, (x) => x.t.total),
    deliveredKnown = totals.every((x) => x.c.delivered !== null),
    sentKnown = totals.every((x) => x.c.sent !== null),
    delivered = sum(totals, (x) => x.c.delivered ?? 0),
    sent = sum(totals, (x) => x.c.sent ?? 0);
  const due = (kind: "income" | "expense") =>
    entries.filter(
      (e) =>
        (kind === "income" ? e.kind === "income" : e.kind !== "income") &&
        outstanding(s, e, currentDay) > 0,
    );
  const legacyRemaining = data!.legacy.length;
  const entryTable = (list: Entry[], showDue = false) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Competência / vencimento</th>
            <th>Valor</th>
            <th>Em aberto</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id}>
              <td>
                <strong>{e.name}</strong>
                <small>
                  {e.kind === "income"
                    ? "Receita"
                    : e.kind === "asset"
                      ? "Aquisição"
                      : "Despesa"}{" "}
                  · {e.category}
                  {e.shared ? " · Compartilhada" : ""}
                </small>
              </td>
              <td>
                {e.competence}
                <small>
                  {e.due}
                  {showDue && e.due < currentDay ? " · Vencida" : ""}
                </small>
              </td>
              <td>{currency(e.amount)}</td>
              <td>{currency(outstanding(s, e, currentDay))}</td>
              <td>
                <div className="row-actions">
                  <button
                    className="text-button"
                    onClick={() => a.editEntry(e)}
                  >
                    Editar
                  </button>
                  {outstanding(s, e) > 0 && (
                    <button className="text-button" onClick={() => a.settle(e)}>
                      {e.kind === "income" ? "Receber" : "Pagar"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && <Empty>Nenhum lançamento encontrado.</Empty>}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span>B</span>bigcash<span className="brand-dot">.</span>
        </div>
        <div className="workspace">
          <span className="workspace-avatar">O</span>
          <div>
            <strong>Minha operação</strong>
            <small>Financeiro gerencial</small>
          </div>
        </div>
        <small className="nav-caption">VISÃO DA OPERAÇÃO</small>
        <nav>
          {navigation.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => {
                setPage(key);
                setMobile(false);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={17} />
          <span>
            Histórico preservado<small>Alterações auditáveis</small>
          </span>
        </div>
        <button
          className="logout"
          onClick={() =>
            void run(async () => {
              await api("logout", "POST");
              setData(null);
              setAuth("login");
            })
          }
        >
          <LogOut size={17} />
          Sair
        </button>
      </aside>
      {mobile && (
        <button
          className="scrim"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Abrir menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <span>
            Financeiro{" "}
            <span className="breadcrumb">
              / {navigation.find((x) => x[0] === page)?.[1]}
            </span>
          </span>
          <div className="topbar-right">
            <span className="status-dot" />
            Dados no servidor
            <button
              className="icon-button"
              aria-label="Atualizar dados"
              disabled={busy}
              onClick={() => void run(load)}
            >
              <RefreshCw size={16} />
            </button>
            <span className="avatar">BC</span>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">BIGCASH · CONTROLE FINANCEIRO</p>
              <h1>{navigation.find((x) => x[0] === page)?.[1]}</h1>
              <p>
                {page === "dashboard"
                  ? "Caixa, custos e resultados. Cada número com sua origem."
                  : page === "entries"
                    ? "Campanhas e rotina financeira em um só lugar."
                    : "Registros verificáveis para acompanhar sua operação."}
              </p>
            </div>
            {page === "entries" ? (
              <button onClick={() => a.editCampaign()}>
                <Plus size={18} /> Nova campanha
              </button>
            ) : page === "accounts" ? (
              <button onClick={() => a.editAccount()}>
                <Plus size={18} /> Nova conta
              </button>
            ) : (
              <button className="secondary" onClick={() => a.editEntry()}>
                <Plus size={18} /> Novo lançamento
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              {notice}
              <button className="text-button" onClick={() => setNotice("")}>
                Fechar
              </button>
            </div>
          )}
          {legacyRemaining > 0 && (
            <div className="notice">
              Histórico preservado: {legacyRemaining} cadastro(s) anteriores.
              Relatórios incluem somente ocorrências convertidas e registros
              novos. Confira as conversões e recorrências em Configurações.
            </div>
          )}
          <div className="filters">
            <label>
              De
              <input
                type="date"
                value={from}
                onChange={(e) =>
                  setFrom(
                    e.target.value
                      ? e.target.value > to
                        ? to
                        : e.target.value
                      : today().slice(0, 7) + "-01",
                  )
                }
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={to}
                onChange={(e) =>
                  setTo(
                    e.target.value
                      ? e.target.value < from
                        ? from
                        : e.target.value
                      : today(),
                  )
                }
              />
            </label>
            <label>
              Conta
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
              >
                <option value="">Todas as contas</option>
                {s.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cliente
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <option value="">Todos os clientes</option>
                {[
                  ...new Set(
                    [
                      ...s.campaigns.map((c) => c.client),
                      ...s.entries.map((e) => e.client),
                    ].filter(Boolean),
                  ),
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Operação
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">Próprias e clientes</option>
                <option value="own">Operação própria</option>
                <option value="client">Clientes</option>
              </select>
            </label>
          </div>
          {page === "dashboard" && (
            <>
              <p className="muted filter-note">
                Saldos por conta até a data final. Cliente e operação filtram
                campanhas e títulos; não fracionam o saldo bancário.
              </p>
              <div className="section-kicker">
                POSIÇÃO DE CAIXA{" "}
                <span>
                  Até {to} ·{" "}
                  {unknownBalances ? "saldos incompletos" : "saldos informados"}
                </span>
              </div>
              <div className="metrics">
                <Metric
                  label="Saldos bancários conhecidos"
                  value={currency(bankTotal)}
                  detail={
                    unknownBalances
                      ? `${unknownBalances} conta(s) sem saldo confirmado`
                      : "Saldo não equivale a dinheiro livre"
                  }
                />
                <Metric
                  label="Saldos nas plataformas"
                  value={currency(walletTotal)}
                  detail="Créditos separados do dinheiro bancário"
                />
                <Metric
                  label="Recebimentos do período"
                  value={currency(sum(cash, (x) => x.receipts))}
                  detail="Pela data de liquidação"
                />
                <Metric
                  label="Pagamentos do período"
                  value={currency(sum(cash, (x) => x.payments))}
                  detail="Transferências próprias separadas"
                />
              </div>
              <div className="metrics compact">
                <Metric
                  label="Bancário disponível"
                  value={currency(
                    sum(
                      balances.filter(
                        (x) =>
                          x.a.kind === "bank" &&
                          x.a.availability === "available",
                      ),
                      (x) => x.balance ?? 0,
                    ),
                  )}
                  detail="Antes dos compromissos e reservas"
                />
                <Metric
                  label="Valores bloqueados"
                  value={currency(
                    sum(
                      balances.filter((x) => x.a.availability === "blocked"),
                      (x) => x.balance ?? 0,
                    ),
                  )}
                />
                <Metric
                  label="Restritos ao consumo"
                  value={currency(
                    sum(
                      balances.filter((x) => x.a.availability === "restricted"),
                      (x) => x.balance ?? 0,
                    ),
                  )}
                />
                <Metric
                  label="Reserva identificada"
                  value={currency(sum(accounts, (a) => a.reserve))}
                  detail={`Parte do saldo · meta ${currency(s.settings.reserveTarget)}`}
                />
              </div>
              <div className="two-columns">
                <Section title="Compromissos e projeção">
                  <div className="summary-row">
                    <span>Contas a pagar em aberto</span>
                    <strong>
                      {currency(
                        sum(due("expense"), (e) =>
                          outstanding(s, e, currentDay),
                        ),
                      )}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Contas a receber em aberto</span>
                    <strong>
                      {currency(
                        sum(due("income"), (e) =>
                          outstanding(s, e, currentDay),
                        ),
                      )}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Vencidas · pagar / receber</span>
                    <strong>
                      {due("expense").filter((e) => e.due < currentDay).length}{" "}
                      / {due("income").filter((e) => e.due < currentDay).length}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Próximos 7 dias · pagar / receber</span>
                    <strong>
                      {
                        due("expense").filter(
                          (e) =>
                            e.due >= currentDay &&
                            e.due <=
                              new Date(Date.parse(currentDay) + 7 * 86400000)
                                .toISOString()
                                .slice(0, 10),
                        ).length
                      }{" "}
                      /{" "}
                      {
                        due("income").filter(
                          (e) =>
                            e.due >= currentDay &&
                            e.due <=
                              new Date(Date.parse(currentDay) + 7 * 86400000)
                                .toISOString()
                                .slice(0, 10),
                        ).length
                      }
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Variação prevista no período</span>
                    <strong>
                      {currency(
                        sum(
                          cash,
                          (x) => x.expectedReceipts - x.expectedPayments,
                        ),
                      )}
                    </strong>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPage("cashflow")}
                  >
                    Abrir fluxo de caixa →
                  </button>
                </Section>
                <Section title="Atenção à operação">
                  <div className="attention">
                    <span className="attention-number">
                      {
                        totals.filter((x) => x.t.pending.includes("meta"))
                          .length
                      }
                    </span>
                    <div>
                      <strong>Campanhas aguardando Meta</strong>
                      <small>Resultado parcial até a apuração</small>
                    </div>
                  </div>
                  <div className="attention">
                    <span className="attention-number">
                      {
                        s.statements.filter(
                          (x) =>
                            (!accountFilter || x.accountId === accountFilter) &&
                            inPeriod(x.date, from, to) &&
                            sum(x.matches, (m) => m.amount) <
                              Math.abs(x.amount),
                        ).length
                      }
                    </span>
                    <div>
                      <strong>Pendências de conciliação</strong>
                      <small>Extratos aguardando identificação</small>
                    </div>
                  </div>
                  <div className="attention">
                    <span className="attention-number">
                      {
                        s.resources.filter(
                          (r) => r.kind === "bm" && r.status === "available",
                        ).length
                      }{" "}
                      /{" "}
                      {
                        s.resources.filter(
                          (r) => r.kind === "bm" && r.status === "closed",
                        ).length
                      }
                    </span>
                    <div>
                      <strong>BMs disponíveis / encerradas</strong>
                      <small>Inventário geral, independente do período</small>
                    </div>
                  </div>
                </Section>
              </div>
              <div className="section-kicker">
                CAMPANHAS NO PERÍODO{" "}
                <span>
                  {periodCampaigns.length} campanhas ·{" "}
                  {campaigns.filter((c) => !c.planned && !c.performed).length}{" "}
                  sem data
                </span>
              </div>
              <div className="metrics">
                <Metric
                  label="Custo gerencial das campanhas"
                  value={currency(totalCosts)}
                  detail={`${currency(sum(totals, (x) => x.t.estimated))} estimados`}
                />
                <Metric
                  label="Enviadas / entregues"
                  value={`${count(sentKnown ? sent : null)} / ${count(deliveredKnown ? delivered : null)}`}
                />
                <Metric
                  label="Custo médio por entrega"
                  value={unit(
                    deliveredKnown && delivered > 0
                      ? totalCosts / delivered
                      : null,
                  )}
                  detail="Custo total ÷ entregas totais"
                />
                <Metric
                  label="Resultado por competência"
                  value={currency(ledger.result)}
                  detail={`${totals.filter((x) => !x.t.complete).length} campanhas com apuração incompleta`}
                />
              </div>
              <div className="metrics compact">
                <Metric
                  label="Resultado de campanhas fechadas"
                  value={currency(
                    sum(
                      totals.filter(
                        (x) =>
                          x.c.financial === "closed" &&
                          x.t.complete &&
                          x.t.result !== null,
                      ),
                      (x) => x.t.result!,
                    ),
                  )}
                />
                <Metric
                  label="Resultados ainda incompletos"
                  value={totals.filter((x) => !x.t.complete).length}
                  detail="Custos ou bases de apuração pendentes"
                />
              </div>
              <Section
                title="Campanhas recentes"
                actions={
                  <button
                    className="text-button"
                    onClick={() => setPage("entries")}
                  >
                    Ver lançamentos →
                  </button>
                }
              >
                {periodCampaigns
                  .slice(-5)
                  .reverse()
                  .map((c) => (
                    <CampaignCard key={c.id} s={s} c={c} actions={a} />
                  ))}
                {!periodCampaigns.length && (
                  <Empty>
                    Cadastre sua primeira campanha em Lançamentos. Nenhum dado
                    fictício é exibido.
                  </Empty>
                )}
              </Section>
            </>
          )}
          {page === "entries" && (
            <>
              <Section
                title="Campanhas de disparo"
                actions={
                  <div className="toolbar">
                    <button className="text-button" onClick={a.allocateShared}>
                      Fechar rateio
                    </button>
                    <button
                      className="secondary"
                      onClick={() => a.editCampaign()}
                    >
                      <Plus size={16} />
                      Campanha
                    </button>
                  </div>
                }
              >
                {campaigns
                  .filter(
                    (c) =>
                      (!c.planned && !c.performed) ||
                      inPeriod(c.performed || c.planned, from, to),
                  )
                  .map((c) => (
                    <CampaignCard key={c.id} s={s} c={c} actions={a} />
                  ))}
                {!campaigns.length && (
                  <Empty>
                    As campanhas, os custos e a precificação ficam nesta área.
                  </Empty>
                )}
              </Section>
              <Section
                title="Lançamentos financeiros"
                actions={
                  <button className="secondary" onClick={() => a.editEntry()}>
                    <Plus size={16} />
                    Lançamento
                  </button>
                }
              >
                {entryTable(
                  entries.filter((e) => inPeriod(e.competence, from, to)),
                )}
              </Section>
              <Resources s={s} actions={a} />
              <details className="auxiliary">
                <summary>
                  Movimentações e estornos <ChevronDown size={18} />
                </summary>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Conta</th>
                        <th>Valor</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {selected.settlements
                        .filter((m) => inPeriod(m.date, from, to))
                        .map((m) => (
                          <tr key={m.id}>
                            <td>{m.date}</td>
                            <td>
                              {m.notes ||
                                {
                                  payment: "Pagamento",
                                  receipt: "Recebimento",
                                  transfer: "Transferência",
                                  topup: "Recarga",
                                  refund: "Estorno",
                                }[m.kind]}
                            </td>
                            <td>
                              {
                                s.accounts.find((a) => a.id === m.accountId)
                                  ?.name
                              }
                            </td>
                            <td>{currency(m.amount)}</td>
                            <td>
                              {["payment", "receipt"].includes(m.kind) && (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    a.settle(undefined, "refund", m)
                                  }
                                >
                                  Estornar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
          {page === "accounts" && (
            <>
              <div className="toolbar right">
                <button
                  className="secondary"
                  onClick={() => a.settle(undefined, "transfer")}
                >
                  Transferir entre contas
                </button>
                <button onClick={() => a.settle(undefined, "topup")}>
                  Recarregar carteira
                </button>
              </div>
              <div className="resource-grid">
                {balances.map(({ a: account, balance }) => (
                  <div className="account-card" key={account.id}>
                    <div className="toolbar">
                      <Landmark size={23} />
                      <small>
                        {account.kind === "bank" ? "Banco" : "Plataforma"}
                      </small>
                    </div>
                    <h2>{account.name}</h2>
                    <p>{account.owner}</p>
                    <strong className="account-balance">
                      {currency(balance)}
                    </strong>
                    <p>
                      {account.availability === "blocked"
                        ? "Bloqueado"
                        : account.availability === "restricted"
                          ? "Restrito ao consumo"
                          : "Disponível"}
                    </p>
                    <small>
                      {account.source} · conferência{" "}
                      {account.updatedAt || "não informada"}
                    </small>
                    <small>
                      Calculado até {to}. Reserva interna:{" "}
                      {currency(account.reserve)}.
                    </small>
                    <button
                      className="text-button"
                      onClick={() => a.editAccount(account)}
                    >
                      Editar cadastro
                    </button>
                  </div>
                ))}
              </div>
              {!accounts.length && (
                <Empty>
                  Nenhum saldo inicial foi presumido. Adicione suas contas e
                  carteiras.
                </Empty>
              )}
            </>
          )}
          {(page === "payables" || page === "receivables") && (
            <>
              <div className="notice">
                Saldo dos títulos até {currentDay}. Todos os vencimentos ficam
                visíveis para não ocultar atrasos.
              </div>
              <Section
                title={
                  page === "payables"
                    ? "Pagamentos pendentes e parciais"
                    : "Recebimentos pendentes e parciais"
                }
              >
                {entryTable(
                  due(page === "payables" ? "expense" : "income").sort((a, b) =>
                    a.due.localeCompare(b.due),
                  ),
                  true,
                )}
              </Section>
            </>
          )}
          {page === "cashflow" && (
            <Section title="Realizado e previsto">
              <p className="muted">
                Realizado até {currentDay}. Vencidos entram na previsão de hoje.
                Transferências e recargas ficam nas movimentações, sem inflar
                recebimentos ou despesas consolidadas.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Recebido</th>
                      <th>Pago</th>
                      <th>Receber previsto</th>
                      <th>Pagar previsto</th>
                      <th>Variação prevista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cash.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{currency(row.receipts)}</td>
                        <td>{currency(row.payments)}</td>
                        <td>{currency(row.expectedReceipts)}</td>
                        <td>{currency(row.expectedPayments)}</td>
                        <td>
                          {currency(
                            row.expectedReceipts - row.expectedPayments,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!cash.length && (
                  <Empty>Sem movimentos ou títulos no período.</Empty>
                )}
              </div>
            </Section>
          )}
          {page === "dre" && (
            <Section title="DRE gerencial por competência">
              <div className="notice">
                Resultado conforme custos confirmados.{" "}
                {totals.filter((x) => !x.t.complete).length} campanhas
                incompletas. Aquisições são distribuídas no uso; rateios não são
                somados novamente.
              </div>
              {[
                ["Receitas reconhecidas", ledger.revenue],
                ["Despesas reconhecidas", -ledger.expenses],
                ["Consumo e distribuição de recursos", -ledger.consumption],
                ["Baixas de recursos", -ledger.writeOff],
                ["Resultado gerencial (pode estar incompleto)", ledger.result],
              ].map(([label, value]) => (
                <div className="dre-row" key={String(label)}>
                  <span>{label}</span>
                  <strong>{currency(Number(value))}</strong>
                </div>
              ))}
              {entryTable(
                entries.filter(
                  (e) => inPeriod(e.competence, from, to) && e.kind !== "asset",
                ),
              )}
            </Section>
          )}
          {page === "position" && (
            <Section title="Posição patrimonial — incompleta">
              <div className="notice">
                Não é um balanço contábil oficial. Saldos iniciais, obrigações
                anteriores e registros contábeis completos precisam ser
                conferidos. Reservas estão contidas no caixa.
              </div>
              {[
                ["Bancos (conhecidos)", bankTotal],
                ["Carteiras (conhecidas)", walletTotal],
                [
                  "Valores a receber",
                  sum(
                    entries.filter(
                      (e) => e.kind === "income" && e.competence <= to,
                    ),
                    (e) => outstanding(s, e, to),
                  ),
                ],
                [
                  "Recursos: custo ainda não distribuído",
                  sum(
                    s.resources.filter((r) => !r.acquired || r.acquired <= to),
                    (r) =>
                      (r.amount ?? 0) -
                      sum(
                        s.costs.filter(
                          (c) =>
                            c.resourceId === r.id &&
                            c.status === "confirmed" &&
                            c.date! <= to,
                        ),
                        (c) => c.amount!,
                      ) -
                      sum(
                        s.writeOffs.filter(
                          (w) => w.resourceId === r.id && w.date <= to,
                        ),
                        (w) => w.amount,
                      ),
                  ),
                ],
                [
                  "Obrigações a pagar",
                  sum(
                    entries.filter(
                      (e) => e.kind !== "income" && e.competence <= to,
                    ),
                    (e) => outstanding(s, e, to),
                  ),
                ],
              ].map(([label, value]) => (
                <div className="dre-row" key={String(label)}>
                  <span>{label}</span>
                  <strong>{currency(Number(value))}</strong>
                </div>
              ))}
              <p>
                {unknownBalances} conta(s) sem saldo confirmado;{" "}
                {s.resources.filter((r) => r.amount === null).length} recurso(s)
                sem aquisição informada.
              </p>
            </Section>
          )}
          {page === "statements" && (
            <StatementsPage
              state={s}
              from={from}
              to={to}
              accountFilter={accountFilter}
              busy={busy}
              run={run}
              open={setEditor}
              save={save}
              imported={(result) => {
                setData({ ...data!, ...result });
                setNotice(
                  "Importação concluída. Arquivos e movimentos repetidos foram ignorados.",
                );
              }}
              version={data!.version}
            />
          )}
          {page === "settings" && (
            <SettingsPage
              s={s}
              legacy={data!.legacy}
              legacyOpening={data!.legacyOpening}
              from={from}
              to={to}
              open={setEditor}
              save={save}
              actions={a}
            />
          )}
        </main>
        <footer className="page-footer">
          BigCash · Visão gerencial da operação{" "}
          <span>Versão de dados {data!.version}</span>
        </footer>
      </div>
      {editor && <Dialog editor={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

