import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Calculator,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  LayoutDashboard,
  Wallet,
  Layers,
  Box,
  Receipt,
  Repeat2,
  Users,
  Landmark,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Pencil,
  Trash2,
  Check,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Menu,
  TrendingUp,
  Leaf,
  CalendarDays,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import {
  labels,
  money,
  today,
  displayDate,
  entryAmount,
  movements,
  totals,
  type Entry,
  type Kind,
} from "./finance";
import "./style.css";
import { Pricing } from "./PricingPage";
import { Notifications, registerWorker } from "./NotificationsPage";
import { buildAlerts } from "./notifications";
import { Goals } from "./Goals";
const icons = {
  income: TrendingUp,
  daily: Wallet,
  tool: Box,
  bm: Layers,
  fee: Receipt,
  fixed: Repeat2,
  salary: Users,
  payroll: Users,
};
const empty = (kind: Kind): Entry => ({
  id: "",
  kind,
  name: "",
  amount: 0,
  date: today(),
  category: "Geral",
  notes: "",
  recurring: ["tool", "fixed", "salary", "payroll"].includes(kind),
  endDate: "",
  status: "paid",
  feeType: "percent",
  feeValue: 0,
  feeClass: "service",
  incomeId: "",
  parts: ["Perfil", "BM", "Instagram", "SMS"].map((name) => ({
    name,
    amount: 0,
  })),
  review: false,
});
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await r.json()) as {
    error?: string;
    entries: Entry[];
    openingBalance: number;
  };
  if (!r.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}
const numberValue = (s: string) => Math.round(Number(s) * 100);
function MoneyField({
  label,
  value,
  onChange,
  negative = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  negative?: boolean;
}) {
  return (
    <label>
      {label}
      <div className="money-input">
        <span>R$</span>
        <input
          aria-label={label}
          type="number"
          step="0.01"
          min={negative ? undefined : 0}
          max="1000000000"
          value={value === 0 ? "" : value / 100}
          placeholder="0,00"
          onChange={(e) => onChange(numberValue(e.target.value))}
        />
      </div>
    </label>
  );
}
function App() {
  const [auth, setAuth] = useState<"loading" | "login" | "ready">("loading");
  const [password, setPassword] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balance, setBalance] = useState(0);
  const [monthGoal, setMonthGoal] = useState<{
    revenue_target: number;
    profit_target: number;
  } | null>(null);
  const [goalError, setGoalError] = useState("");

  const [page, setPage] = useState<
    Kind | "dashboard" | "cash" | "pricing" | "notifications" | "goals"
  >(
    new URLSearchParams(location.search).get("view") === "notifications"
      ? "notifications"
      : "dashboard",
  );
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState<Entry | null>(null);
  const [cashModal, setCashModal] = useState(false);
  const [newBalance, setNewBalance] = useState(0);
  const [del, setDel] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [listPage, setListPage] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (auth !== "ready") return;
    const refresh = () =>
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: unknown) => {
          if (d && typeof d === "object" && "alerts" in d)
            setUnreadCount(
              (d as { alerts: { read: boolean }[] }).alerts.filter(
                (a) => !a.read,
              ).length,
            );
        })
        .catch(() => {});
    void refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [auth, entries, page]);
  useEffect(() => {
    if (auth !== "ready" || page !== "dashboard") return;
    const controller = new AbortController();
    setGoalError("");
    setMonthGoal(null);
    fetch("/api/monthly-goals", { signal: controller.signal })
      .then(async (r) => {
        const d = (await r.json()) as {
          months: {
            month: string;
            revenue_target: number;
            profit_target: number;
          }[];
          error?: string;
        };
        if (!r.ok)
          throw Error(d.error || "Não foi possível carregar as metas.");
        setMonthGoal(
          d.months.find((m) => m.month === today().slice(0, 7)) ?? {
            revenue_target: 0,
            profit_target: 0,
          },
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setGoalError(e.message);
      });
    return () => controller.abort();
  }, [auth, page]);
  const specialPage =
    page === "pricing" || page === "notifications" || page === "goals";
  const specialTitle =
    page === "pricing"
      ? "Precificação por chips"
      : page === "goals"
        ? "Metas"
        : "Notificações";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const load = async () => {
    const d = await api("data");
    setEntries(d.entries);
    setBalance(d.openingBalance);
    setAuth("ready");
  };
  useEffect(() => {
    load().catch(() => setAuth("login"));
    registerWorker().catch(() => {});
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    setQuery("");
    setStatus("all");
    setListPage(0);
  }, [page]);
  useEffect(() => {
    if (modal || cashModal || del) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [modal, cashModal, del]);
  const range = (p: string) => {
    setPeriod(p);
    const now = new Date(today() + "T12:00:00");
    let first = today().slice(0, 7) + "-01",
      last = today();
    if (p === "last") {
      now.setDate(0);
      first = now.toISOString().slice(0, 7) + "-01";
      last = now.toISOString().slice(0, 10);
    }
    if (p === "year") first = today().slice(0, 4) + "-01-01";
    if (p === "all") first = "2000-01-01";
    setFrom(first);
    setTo(last);
  };
  const rows = movements(entries, from, to);
  const sums = totals(rows);
  const monthlySums = totals(
    movements(entries, today().slice(0, 7) + "-01", today()),
  );
  const allRows = movements(entries, "2000-01-01", today());
  const total = totals(allRows);
  const cash = balance + total.net;
  const pending = rows
    .filter((x) => x.status === "pending")
    .reduce((s, x) => s + (x.kind === "income" ? x.total : -x.total), 0);
  const margin = sums.income ? (sums.net / sums.income) * 100 : 0;
  const notify = (s: string) => {
    setToast(s);
    setError("");
  };
  const close = () => {
    if (!busy) {
      setModal(null);
      setCashModal(false);
      setDel(null);
      setError("");
    }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (modal) {
        await api("entries", "POST", modal);
        setModal(null);
      } else if (cashModal) {
        await api("settings", "PUT", { openingBalance: newBalance });
        setCashModal(false);
      } else if (del) {
        await api("entries/" + del.id, "DELETE");
        setDel(null);
      }
      await load();
      notify("Tudo certo! Alterações salvas.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const update = (key: keyof Entry, value: unknown) =>
    setModal((prev) => (prev ? { ...prev, [key]: value } : prev));
  const navigate = (p: typeof page) => {
    setPage(p);
    setMobile(false);
  };
  const filtered = entries
    .filter(
      (e) =>
        e.kind === page &&
        (!query ||
          (e.name + " " + e.category + " " + e.notes)
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (status === "all" || e.status === status),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const download = () => {
    const data =
      page === "dashboard"
        ? rows
        : page === "cash"
          ? allRows
          : filtered.map((e) => ({
              ...e,
              total: entryAmount(e, entries),
              occurrence: e.date,
            }));
    const cell = (s: unknown) =>
      '"' +
      String(s)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const csv =
      "\uFEFF" +
      [
        ["Data", "Descrição", "Tipo", "Categoria", "Valor (R$)", "Situação"],
        ...data.map((e) => [
          e.occurrence,
          e.name,
          labels[e.kind],
          e.category,
          (e.total / 100).toFixed(2).replace(".", ","),
          e.status === "paid" ? "Concluído" : "Pendente",
        ]),
      ]
        .map((r) => r.map(cell).join(";"))
        .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    a.download = "bigcash-" + page + "-" + today() + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    notify("Exportação concluída.");
  };
  const nav = (key: typeof page, label: string, Icon: typeof Wallet) => (
    <button
      className={"nav-item " + (page === key ? "active" : "")}
      onClick={() => navigate(key)}
    >
      <Icon size={18} />
      <span>{label}</span>
      {page === key && <i />}
    </button>
  );
  const open = (e: Entry) => {
    setError("");
    setModal(structuredClone(e));
  };
  const expenseGroups = (Object.keys(labels) as Kind[])
    .filter((k) => k !== "income")
    .map((k) => ({
      kind: k,
      value: rows
        .filter((r) => r.kind === k && r.status === "paid")
        .reduce((s, r) => s + r.total, 0),
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const flagged = entries.filter((e) => e.review && e.kind !== "income");
  const monthly = entries
    .filter((e) => e.recurring && (!e.endDate || e.endDate >= today()))
    .reduce((s, e) => s + entryAmount(e, entries), 0);
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const start = Date.parse(from + "T12:00:00Z"),
      end = Date.parse(to + "T12:00:00Z");
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const a = new Date(start + Math.floor((i * days) / 7) * 86400000)
      .toISOString()
      .slice(0, 10);
    const b = new Date(
      start + Math.floor(((i + 1) * days) / 7) * 86400000 - 86400000,
    )
      .toISOString()
      .slice(0, 10);
    return {
      date: a,
      ...totals(rows.filter((r) => r.occurrence >= a && r.occurrence <= b)),
    };
  });
  const maxChart = Math.max(
    ...buckets.flatMap((x) => [x.income, x.expense]),
    100,
  );
  if (auth === "loading")
    return (
      <div className="loading">
        <LoaderCircle className="spin" /> Abrindo seu BigCash…
      </div>
    );
  if (auth === "login")
    return (
      <div className="login">
        <div className="login-story">
          <div className="brand">
            <span className="brand-icon">
              <TrendingUp />
            </span>
            bigcash<span className="brand-dot">.</span>
          </div>
          <div>
            <span className="eyebrow">MENOS PLANILHAS. MAIS CLAREZA.</span>
            <h1>
              Seu dinheiro.
              <br />
              Sua visão.
              <br />
              <em>Seu próximo passo.</em>
            </h1>
            <p>As finanças da sua empresa, organizadas em um só lugar.</p>
          </div>
          <span className="login-footer">
            <ShieldCheck size={17} /> Dados privados · Acesso protegido
          </span>
        </div>
        <div className="login-form">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("login", "POST", { password });
                await load();
                setPassword("");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <span className="login-badge">
              <Landmark size={25} />
            </span>
            <h2>Bom ter você por aqui.</h2>
            <p>Entre para acompanhar a saúde do seu negócio.</p>
            <label>
              Senha de acesso
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Entrando…" : "Acessar meu financeiro"}
              <ArrowRight size={18} />
            </button>
            <small>Seu espaço de gestão financeira.</small>
          </form>
        </div>
      </div>
    );
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-icon">
            <TrendingUp />
          </span>
          bigcash<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <div className="workspace-avatar">B</div>
          <div>
            <strong>Minha empresa</strong>
            <small>Workspace financeiro</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">VISÃO GERAL</div>
        {nav("dashboard", "Dashboard", LayoutDashboard)}
        {nav("cash", "Valor em caixa", Landmark)}
        {nav("pricing", "Precificação por chips", Calculator)}
        {nav("goals", "Metas", TrendingUp)}
        {nav("notifications", "Notificações", Bell)}
        <div className="nav-label spaced">GESTÃO FINANCEIRA</div>
        {nav("income", "Entradas de receita", TrendingUp)}
        {nav("daily", "Gastos diários", Wallet)}
        {nav("tool", "Ferramentas", Box)}
        {nav("bm", "Farm de BM", Layers)}
        {nav("fee", "Taxas e impostos", Receipt)}
        {nav("fixed", "Despesas fixas", Repeat2)}
        {nav("salary", "Pró-labore", Users)}
        {nav("payroll", "Folha salarial", Users)}
        <div className="sidebar-bottom">
          <div className="tip">
            <span>
              <Leaf size={18} /> Um negócio mais saudável
            </span>
            <p>
              Pequenas economias hoje.
              <br />
              Mais possibilidades amanhã.
            </p>
          </div>
          <button
            className="profile"
            onClick={async () => {
              try {
                await api("logout", "POST");
                setAuth("login");
              } catch (err) {
                notify((err as Error).message);
              }
            }}
          >
            <span className="avatar">AD</span>
            <span>
              <strong>Administrador</strong>
              <small>Sair da conta</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="scrim"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} />{" "}
              <strong>
                {page === "dashboard"
                  ? "Dashboard"
                  : page === "cash"
                    ? "Valor em caixa"
                    : specialPage
                      ? specialTitle
                      : labels[page as Kind]}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="notification-bell"
              aria-label="Abrir notificações"
              onClick={() => navigate("notifications")}
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span>{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            <span className="online">
              <i /> Ambiente seguro
            </span>
            <span className="avatar small">AD</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">SEU NEGÓCIO, EM PERSPECTIVA</div>
              <h1>
                {page === "dashboard"
                  ? "Visão geral"
                  : page === "cash"
                    ? "Valor em caixa"
                    : specialPage
                      ? specialTitle
                      : labels[page as Kind]}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === "dashboard"
                  ? "Clareza nos números. Confiança nas próximas decisões."
                  : page === "cash"
                    ? "Acompanhe o dinheiro disponível e cada movimentação."
                    : specialPage
                      ? page === "pricing"
                        ? "Calcule chips, custos e margem para cada lote de mensagens."
                        : page === "goals"
                          ? "Planeje o mês e acompanhe seu histórico de resultados."
                          : "Seus compromissos e alertas, sempre à mão."
                      : (
                          {
                            income:
                              "Organize suas entradas e acompanhe o que realmente fica.",
                            daily:
                              "Cada gasto conta. Registre e acompanhe suas despesas.",
                            tool: "Suas assinaturas e ferramentas, sem surpresas no fim do mês.",
                            bm: "Entenda o custo completo de cada BM da sua operação.",
                            fee: "Taxas e impostos conectados às suas receitas.",
                            fixed:
                              "Previsibilidade para os compromissos da sua empresa.",
                            salary:
                              "Organize as retiradas dos sócios com transparência.",
                            payroll:
                              "Registre os pagamentos de funcionários e encargos da folha.",
                          } as Record<Kind, string>
                        )[page as Kind]}
              </p>
            </div>
            {!specialPage && (
              <div className="heading-actions">
                <button className="secondary" onClick={download}>
                  <Download size={16} />
                  Exportar
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    page === "cash"
                      ? (setNewBalance(balance), setCashModal(true))
                      : open(
                          empty(
                            page === "dashboard" ? "daily" : (page as Kind),
                          ),
                        )
                  }
                >
                  <Plus size={17} />
                  {page === "cash" ? "Saldo inicial" : "Novo lançamento"}
                </button>
              </div>
            )}
          </div>
          {page === "pricing" ? (
            <Pricing entries={entries} />
          ) : page === "notifications" ? (
            <Notifications
              navigate={navigate}
              onUnreadChange={setUnreadCount}
            />
          ) : page === "goals" ? (
            <Goals />
          ) : page === "dashboard" ? (
            <>
              <div className="period-row">
                <div className="tabs">
                  {[
                    ["month", "Este mês"],
                    ["last", "Mês passado"],
                    ["year", "Este ano"],
                    ["all", "Tudo"],
                  ].map(([k, l]) => (
                    <button
                      key={k}
                      className={period === k ? "selected" : ""}
                      onClick={() => range(k)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="date-range">
                  <CalendarDays size={16} />
                  <input
                    aria-label="Data inicial"
                    type="date"
                    value={from}
                    max={to}
                    min="2000-01-01"
                    onChange={(e) => {
                      if (e.target.value && e.target.value <= to) {
                        setFrom(e.target.value);
                        setPeriod("custom");
                      }
                    }}
                  />
                  <span>—</span>
                  <input
                    aria-label="Data final"
                    type="date"
                    value={to}
                    min={from}
                    max="2100-12-31"
                    onChange={(e) => {
                      if (e.target.value && e.target.value >= from) {
                        setTo(e.target.value);
                        setPeriod("custom");
                      }
                    }}
                  />
                </div>
              </div>
              <div className="stats">
                <Stat
                  label="Receita recebida"
                  value={money(sums.income)}
                  Icon={ArrowUpRight}
                  detail="Entradas confirmadas no período"
                />
                <Stat
                  label="Despesas pagas"
                  value={money(sums.expense)}
                  Icon={ArrowDownRight}
                  detail="Todos os custos do período"
                />
                <Stat
                  label="Resultado do período"
                  value={money(sums.net)}
                  Icon={TrendingUp}
                  detail={
                    sums.income
                      ? `${margin.toFixed(1).replace(".", ",")}% de margem sobre a receita`
                      : "Receitas menos despesas"
                  }
                />
                <Stat
                  label="Disponível em caixa"
                  value={money(cash)}
                  Icon={Landmark}
                  detail="Saldo acumulado até hoje"
                  dark
                />
              </div>
              <section className="panel goals-panel">
                <PanelHead
                  title="Metas do mês"
                  sub="Faturamento e lucro do mês atual, independentemente do filtro acima"
                  action={
                    <button
                      className="text-button"
                      onClick={() => navigate("goals")}
                    >
                      Ver metas <ArrowRight size={14} />
                    </button>
                  }
                />
                {goalError && <p role="alert">{goalError}</p>}
                <div className="goals-grid">
                  {[
                    {
                      label: "Faturamento do mês",
                      actual: monthlySums.income,
                      target: monthGoal?.revenue_target,
                    },
                    {
                      label: "Lucro do mês",
                      actual: monthlySums.net,
                      target: monthGoal?.profit_target,
                    },
                  ].map((item) => (
                    <div className="goal-card" key={item.label}>
                      <h3>{item.label}</h3>
                      <strong>{money(item.actual)}</strong>
                      <p>
                        {monthGoal === null
                          ? goalError
                            ? "Meta indisponível"
                            : "Carregando meta…"
                          : item.target
                            ? `Meta: ${money(item.target)} · ${((item.actual / item.target) * 100).toFixed(1).replace(".", ",")}% atingido`
                            : "Meta não definida"}
                      </p>
                      <progress
                        aria-label={`Progresso de ${item.label}`}
                        max={100}
                        value={
                          item.target
                            ? Math.max(
                                0,
                                Math.min(
                                  100,
                                  (item.actual / item.target) * 100,
                                ),
                              )
                            : 0
                        }
                      />
                    </div>
                  ))}
                </div>
                <p>
                  O lucro desconta despesas, impostos, folha salarial e
                  pró-labore.
                </p>
              </section>
              <div className="dashboard-grid">
                <section className="panel flow">
                  <PanelHead
                    title="Fluxo financeiro"
                    sub="O movimento do seu dinheiro no período"
                    action={
                      <div className="legend">
                        <span>
                          <i />
                          Receitas
                        </span>
                        <span>
                          <i className="pale" />
                          Despesas
                        </span>
                      </div>
                    }
                  />
                  <div className="chart">
                    <div className="chart-labels">
                      {[1, 0.75, 0.5, 0.25, 0].map((n) => (
                        <span key={n}>{money(maxChart * n)}</span>
                      ))}
                    </div>
                    <div className="chart-plot">
                      <div className="gridlines">
                        {[0, 1, 2, 3, 4].map((n) => (
                          <i key={n} />
                        ))}
                      </div>
                      <div className="bars">
                        {buckets.map((b, i) => (
                          <div className="bar-group" key={i}>
                            <div className="bar-pair">
                              <div
                                title={"Receitas: " + money(b.income)}
                                className="bar income"
                                style={{
                                  height: `${(b.income / maxChart) * 100}%`,
                                }}
                              />
                              <div
                                title={"Despesas: " + money(b.expense)}
                                className="bar expense"
                                style={{
                                  height: `${(b.expense / maxChart) * 100}%`,
                                }}
                              />
                            </div>
                            <span>{displayDate(b.date).slice(0, 5)}</span>
                          </div>
                        ))}
                      </div>
                      {!rows.length && (
                        <div className="chart-empty">
                          <TrendingUp size={25} />
                          <strong>Seu próximo capítulo começa aqui</strong>
                          <span>
                            Adicione um lançamento para acompanhar o fluxo.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="chart-footer">
                    <span>
                      <i className="live-dot" /> Valores calculados a partir dos
                      seus registros
                    </span>
                    <strong>
                      {money(sums.net)} <small>no período</small>
                    </strong>
                  </div>
                </section>
                <section className="panel distribution">
                  <PanelHead
                    title="Para onde vai o dinheiro"
                    sub="Distribuição das despesas pagas"
                  />
                  <div className="donut-wrap">
                    <div
                      className="donut"
                      style={{
                        background: sums.expense
                          ? `conic-gradient(${expenseGroups
                              .map((g, i) => {
                                const start =
                                  (expenseGroups
                                    .slice(0, i)
                                    .reduce((s, g) => s + g.value, 0) /
                                    sums.expense) *
                                  100;
                                return `${["#1c6b4d", "#68a985", "#accbb2", "#d9e7d6", "#8baa64", "#d9caa5"][i]} ${start}% ${start + (g.value / sums.expense) * 100}%`;
                              })
                              .join(",")})`
                          : "#edf2ec",
                      }}
                    >
                      <div>
                        <span>Total de despesas</span>
                        <strong>{money(sums.expense)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="category-list">
                    {expenseGroups.length ? (
                      expenseGroups.slice(0, 6).map((g, i) => (
                        <div key={g.kind}>
                          <span>
                            <i
                              style={{
                                background: [
                                  "#1c6b4d",
                                  "#68a985",
                                  "#accbb2",
                                  "#d9e7d6",
                                  "#8baa64",
                                  "#d9caa5",
                                ][i],
                              }}
                            />
                            {labels[g.kind]}
                          </span>
                          <strong>
                            {((g.value / sums.expense) * 100).toFixed(0)}%{" "}
                            <small>{money(g.value)}</small>
                          </strong>
                        </div>
                      ))
                    ) : (
                      <p className="muted centered">
                        As categorias aparecerão após o primeiro gasto.
                      </p>
                    )}
                  </div>
                </section>
                <section className="insight-panel">
                  <div className="insight-icon">
                    <Leaf size={22} />
                  </div>
                  <div>
                    <div className="insight-heading">
                      <h3>Um olhar para economizar</h3>
                      <span>INSIGHTS</span>
                    </div>
                    <p>
                      {flagged.length
                        ? `${flagged.length} despesa(s) marcada(s) para revisão. Comece por ${flagged[0].name} e avalie se ainda faz sentido para o negócio.`
                        : monthly
                          ? `Seus compromissos mensais ativos somam ${money(monthly)}. Revise assinaturas e serviços pouco utilizados para reduzir esse custo.`
                          : sums.net < 0
                            ? "As despesas superaram as receitas neste período. Revise os maiores gastos e confira as entradas pendentes."
                            : "Marque despesas para revisão nos cadastros. Assim, fica mais fácil encontrar oportunidades de economia."}
                    </p>
                  </div>
                  <button onClick={() => navigate(flagged[0]?.kind || "tool")}>
                    Revisar despesas <ArrowRight size={16} />
                  </button>
                </section>
                <section className="panel recent">
                  <PanelHead
                    title="Últimas movimentações"
                    sub="O que entrou e saiu no período"
                    action={
                      <button
                        className="text-button"
                        onClick={() => navigate("daily")}
                      >
                        Ver gastos <ArrowRight size={14} />
                      </button>
                    }
                  />
                  {rows.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Descrição</th>
                            <th>Categoria</th>
                            <th>Data</th>
                            <th>Situação</th>
                            <th className="right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 6).map((e, i) => (
                            <tr key={e.id + e.occurrence + i}>
                              <td>
                                <div className="description">
                                  <span
                                    className={
                                      "entry-icon " +
                                      (e.kind === "income" ? "positive" : "")
                                    }
                                  >
                                    {e.kind === "income" ? (
                                      <ArrowUpRight size={17} />
                                    ) : (
                                      <ArrowDownRight size={17} />
                                    )}
                                  </span>
                                  <div>
                                    <strong>{e.name}</strong>
                                    <small>{e.category}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{labels[e.kind]}</td>
                              <td>{displayDate(e.occurrence)}</td>
                              <td>
                                <Badge status={e.status} />
                              </td>
                              <td
                                className={
                                  "right amount " +
                                  (e.kind === "income" ? "green" : "")
                                }
                              >
                                {e.kind === "income" ? "+" : "−"}{" "}
                                {money(e.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Tudo pronto para o primeiro lançamento"
                      text="Suas receitas e despesas vão aparecer aqui."
                      onClick={() => open(empty("income"))}
                    />
                  )}
                </section>
                <section className="panel quick">
                  <PanelHead
                    title="Planeje os próximos passos"
                    sub="Mantenha a operação sob controle"
                  />
                  <div className="quick-stat">
                    <span>Compromissos mensais ativos</span>
                    <strong>{money(monthly)}</strong>
                    <small>Ferramentas, despesas fixas e pró-labore</small>
                  </div>
                  <div className="quick-stat">
                    <span>Resultado pendente no período</span>
                    <strong>{money(pending)}</strong>
                    <small>Entradas previstas menos saídas pendentes</small>
                  </div>
                  <button
                    className="secondary full"
                    onClick={() => navigate("fixed")}
                  >
                    Ver despesas fixas <ArrowRight size={15} />
                  </button>
                </section>
              </div>
            </>
          ) : page === "cash" ? (
            <>
              <div className="stats cash-stats">
                <Stat
                  label="Saldo inicial"
                  value={money(balance)}
                  Icon={Wallet}
                  detail="Valor anterior aos lançamentos cadastrados"
                />
                <Stat
                  label="Resultado acumulado"
                  value={money(total.net)}
                  Icon={TrendingUp}
                  detail="Lançamentos concluídos até hoje"
                />
                <Stat
                  label="Disponível em caixa"
                  value={money(cash)}
                  Icon={Landmark}
                  detail="Saldo inicial + entradas − saídas"
                  dark
                />
              </div>
              <section className="panel">
                <PanelHead
                  title="Como seu saldo é calculado"
                  sub="Somente valores recebidos e pagos até hoje movimentam o caixa."
                />
                <div className="cash-formula">
                  <div>
                    <small>Saldo inicial</small>
                    <strong>{money(balance)}</strong>
                  </div>
                  <b>+</b>
                  <div>
                    <small>Receitas recebidas</small>
                    <strong className="green">{money(total.income)}</strong>
                  </div>
                  <b>−</b>
                  <div>
                    <small>Despesas pagas</small>
                    <strong>{money(total.expense)}</strong>
                  </div>
                  <b>=</b>
                  <div>
                    <small>Em caixa</small>
                    <strong>{money(cash)}</strong>
                  </div>
                </div>
                <p className="info-note">
                  <AlertCircle size={16} /> O saldo inicial deve representar o
                  dinheiro que a empresa tinha antes do primeiro lançamento
                  cadastrado.
                </p>
              </section>
            </>
          ) : (
            <>
              <div className="module-summary">
                <span className="module-icon">
                  {React.createElement(icons[page], { size: 23 })}
                </span>
                <div>
                  <small>
                    {page === "income"
                      ? "Receita bruta cadastrada"
                      : page === "bm"
                        ? "Investimento total em BMs"
                        : page === "fee"
                          ? "Total de taxas cadastradas"
                          : "Total dos valores cadastrados"}
                  </small>
                  <strong>
                    {money(
                      entries
                        .filter((e) => e.kind === page)
                        .reduce((s, e) => s + entryAmount(e, entries), 0),
                    )}
                  </strong>
                </div>
                <span className="summary-count">
                  {entries.filter((e) => e.kind === page).length} registros
                </span>
                {["tool", "fixed", "salary", "payroll"].includes(page) && (
                  <p>
                    Cadastros recorrentes geram uma ocorrência mensal no
                    dashboard, inclusive pendências.
                  </p>
                )}
              </div>
              <section className="panel">
                <div className="list-toolbar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      placeholder="Buscar por descrição ou categoria…"
                      aria-label="Buscar lançamentos"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setListPage(0);
                      }}
                    />
                  </div>
                  <select
                    aria-label="Filtrar situação"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setListPage(0);
                    }}
                  >
                    <option value="all">Todas as situações</option>
                    <option value="paid">Concluídos</option>
                    <option value="pending">Pendentes</option>
                  </select>
                </div>
                {filtered.length ? (
                  <>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Descrição</th>
                            <th>
                              {page === "fee"
                                ? "Receita vinculada"
                                : "Categoria"}
                            </th>
                            <th>Data</th>
                            <th>Situação</th>
                            <th className="right">Valor</th>
                            <th className="right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered
                            .slice(listPage * 10, listPage * 10 + 10)
                            .map((e) => (
                              <tr key={e.id}>
                                <td>
                                  <div className="description">
                                    <span className="entry-icon">
                                      {React.createElement(icons[e.kind], {
                                        size: 17,
                                      })}
                                    </span>
                                    <div>
                                      <strong>
                                        {e.name}{" "}
                                        {e.review && (
                                          <span
                                            title="Revisar despesa"
                                            className="review-dot"
                                          />
                                        )}
                                      </strong>
                                      <small>
                                        {e.recurring
                                          ? "Mensal" +
                                            (e.endDate
                                              ? " · Até " +
                                                displayDate(e.endDate)
                                              : "")
                                          : e.kind === "bm"
                                            ? e.parts
                                                .map((p) => p.name)
                                                .join(" · ")
                                            : e.notes || "Lançamento único"}
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {e.kind === "fee" ? (
                                    <>
                                      {
                                        entries.find((x) => x.id === e.incomeId)
                                          ?.name
                                      }
                                      <small className="block">
                                        {e.feeClass === "tax"
                                          ? "Imposto"
                                          : "Taxa de serviço"}
                                      </small>
                                    </>
                                  ) : (
                                    e.category
                                  )}
                                </td>
                                <td>{displayDate(e.date)}</td>
                                <td>
                                  <Badge status={e.status} />
                                </td>
                                <td className="right amount">
                                  {money(entryAmount(e, entries))}
                                  {e.kind === "income" && e.feeValue > 0 && (
                                    <small className="block">
                                      Líquido:{" "}
                                      {money(
                                        e.amount -
                                          (e.feeType === "percent"
                                            ? Math.round(
                                                (e.amount * e.feeValue) / 10000,
                                              )
                                            : e.feeValue),
                                      )}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      className="icon-button"
                                      aria-label={"Editar " + e.name}
                                      onClick={() => open(e)}
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      className="icon-button danger-icon"
                                      aria-label={"Excluir " + e.name}
                                      onClick={() => setDel(e)}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pagination">
                      <span>{filtered.length} lançamento(s)</span>
                      <div>
                        <button
                          className="icon-button"
                          aria-label="Página anterior"
                          disabled={listPage === 0}
                          onClick={() => setListPage((p) => p - 1)}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span>
                          {listPage + 1} de {Math.ceil(filtered.length / 10)}
                        </span>
                        <button
                          className="icon-button"
                          aria-label="Próxima página"
                          disabled={(listPage + 1) * 10 >= filtered.length}
                          onClick={() => setListPage((p) => p + 1)}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <Empty
                    title={
                      query || status !== "all"
                        ? "Nenhum resultado encontrado"
                        : "Um lugar para cada lançamento"
                    }
                    text={
                      query || status !== "all"
                        ? "Experimente outro termo ou situação."
                        : "Adicione seu primeiro registro e comece a acompanhar."
                    }
                    onClick={() => open(empty(page))}
                  />
                )}
              </section>
            </>
          )}
          <footer className="footer">
            <span>
              bigcash<span className="green">.</span>{" "}
              <small>Gestão com clareza.</small>
            </span>
            <span>
              <ShieldCheck size={13} /> Seus dados, organizados e protegidos.
            </span>
          </footer>
        </div>
      </main>
      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <form onSubmit={save}>
          <div className="modal-header">
            <div>
              <span className="eyebrow">BIGCASH · FINANCEIRO</span>
              <h2>
                {del
                  ? "Excluir lançamento?"
                  : cashModal
                    ? "Configurar saldo inicial"
                    : modal?.id
                      ? "Editar lançamento"
                      : "Novo lançamento"}
              </h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar"
              onClick={close}
              disabled={busy}
            >
              <X size={21} />
            </button>
          </div>
          <div className="modal-body">
            {del ? (
              <p>
                Excluir <strong>{del.name}</strong>?{" "}
                {del.recurring
                  ? "Todas as ocorrências desta recorrência serão removidas."
                  : "O lançamento será removido do financeiro."}{" "}
                Esta ação não pode ser desfeita.
              </p>
            ) : cashModal ? (
              <>
                <p className="muted">
                  Informe o valor em caixa antes dos lançamentos cadastrados.
                  Pode ser negativo.
                </p>
                <MoneyField
                  label="Saldo inicial"
                  value={newBalance}
                  onChange={setNewBalance}
                  negative
                />
              </>
            ) : (
              modal && (
                <>
                  <div className="form-grid">
                    <label>
                      Tipo de lançamento
                      <select
                        value={modal.kind}
                        disabled={!!modal.id}
                        onChange={(e) =>
                          setModal(empty(e.target.value as Kind))
                        }
                      >
                        {Object.entries(labels).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Situação
                      <select
                        value={modal.status}
                        onChange={(e) => update("status", e.target.value)}
                      >
                        <option value="paid">
                          {modal.kind === "income" ? "Recebido" : "Pago"}
                        </option>
                        <option value="pending">Pendente</option>
                      </select>
                    </label>
                    <label className="span2">
                      Descrição
                      <input
                        autoFocus
                        required
                        maxLength={120}
                        value={modal.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder={
                          modal.kind === "bm"
                            ? "Ex.: BM Operação 01"
                            : "Ex.: " +
                              (
                                {
                                  income: "Receita de vendas",
                                  daily: "Almoço com cliente",
                                  tool: "Assinatura de ferramenta",
                                  fixed: "Aluguel do escritório",
                                  salary: "Retirada do sócio",
                                  payroll: "Pagamento de folha salarial",
                                  fee: "Imposto sobre vendas",
                                } as Partial<Record<Kind, string>>
                              )[modal.kind]
                        }
                      />
                    </label>
                    {modal.kind !== "bm" && modal.kind !== "fee" && (
                      <MoneyField
                        label={
                          modal.kind === "income" ? "Valor bruto" : "Valor"
                        }
                        value={modal.amount}
                        onChange={(n) => update("amount", n)}
                      />
                    )}
                    <label>
                      Data{modal.recurring ? " de início" : ""}
                      <input
                        required
                        type="date"
                        min="2000-01-01"
                        max="2100-12-31"
                        value={modal.date}
                        onChange={(e) => update("date", e.target.value)}
                      />
                    </label>
                    <label>
                      Categoria
                      <input
                        required
                        maxLength={100}
                        list="categories"
                        value={modal.category}
                        onChange={(e) => update("category", e.target.value)}
                      />
                      <datalist id="categories">
                        {[
                          "Geral",
                          "Operação",
                          "Marketing",
                          "Administrativo",
                          "Vendas",
                          "Pessoal",
                          "Infraestrutura",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </datalist>
                    </label>
                  </div>
                  {modal.kind === "bm" && (
                    <div className="form-section">
                      <div className="section-title">
                        <h3>Composição do custo</h3>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            update("parts", [
                              ...modal.parts,
                              { name: "Outro custo", amount: 0 },
                            ])
                          }
                        >
                          <Plus size={14} /> Custo variável
                        </button>
                      </div>
                      {modal.parts.map((p, i) => (
                        <div className="part-row" key={i}>
                          <input
                            required
                            aria-label={"Nome do custo " + (i + 1)}
                            value={p.name}
                            maxLength={100}
                            onChange={(e) =>
                              update(
                                "parts",
                                modal.parts.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          <MoneyField
                            label={"Valor de " + p.name}
                            value={p.amount}
                            onChange={(n) =>
                              update(
                                "parts",
                                modal.parts.map((x, j) =>
                                  j === i ? { ...x, amount: n } : x,
                                ),
                              )
                            }
                          />
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={"Remover custo " + p.name}
                            onClick={() =>
                              update(
                                "parts",
                                modal.parts.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <div className="form-total">
                        <span>Custo total da BM</span>
                        <strong>{money(entryAmount(modal, entries))}</strong>
                      </div>
                    </div>
                  )}
                  {(modal.kind === "income" || modal.kind === "fee") && (
                    <div className="form-section">
                      <h3>
                        {modal.kind === "fee"
                          ? "Taxa vinculada à receita"
                          : "Taxa sobre a entrada (opcional)"}
                      </h3>
                      {modal.kind === "fee" && (
                        <label>
                          Receita vinculada
                          <select
                            required
                            value={modal.incomeId}
                            onChange={(e) => update("incomeId", e.target.value)}
                          >
                            <option value="">Selecione uma receita</option>
                            {entries
                              .filter((e) => e.kind === "income")
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.name} · {money(e.amount)}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                      <div className="form-grid">
                        <label>
                          Cálculo
                          <select
                            value={modal.feeType}
                            onChange={(e) => {
                              update("feeType", e.target.value);
                              update("feeValue", 0);
                            }}
                          >
                            <option value="percent">Porcentagem (%)</option>
                            <option value="fixed">Valor fixo (R$)</option>
                          </select>
                        </label>
                        {modal.feeType === "fixed" ? (
                          <MoneyField
                            label="Valor da taxa"
                            value={modal.feeValue}
                            onChange={(n) => update("feeValue", n)}
                          />
                        ) : (
                          <label>
                            Percentual (%)
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={modal.feeValue / 100}
                              onChange={(e) =>
                                update("feeValue", numberValue(e.target.value))
                              }
                            />
                          </label>
                        )}
                        <label>
                          Classificação
                          <select
                            value={modal.feeClass}
                            onChange={(e) => update("feeClass", e.target.value)}
                          >
                            <option value="service">Taxa de serviço</option>
                            <option value="tax">Imposto</option>
                          </select>
                        </label>
                      </div>
                      <p className="field-help">
                        {modal.kind === "fee"
                          ? "A taxa será uma despesa adicional. Não repita taxas já incluídas na receita."
                          : "A taxa é descontada automaticamente no resultado e no caixa."}
                      </p>
                    </div>
                  )}
                  {["tool", "fixed", "salary", "payroll"].includes(
                    modal.kind,
                  ) && (
                    <div className="form-section">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={modal.recurring}
                          onChange={(e) =>
                            update("recurring", e.target.checked)
                          }
                        />{" "}
                        Repetir mensalmente
                      </label>
                      {modal.recurring && (
                        <>
                          <label>
                            Data de encerramento (opcional)
                            <input
                              type="date"
                              min={modal.date}
                              max="2100-12-31"
                              value={modal.endDate}
                              onChange={(e) =>
                                update("endDate", e.target.value)
                              }
                            />
                          </label>
                          <p className="field-help">
                            O valor e a situação se repetem todos os meses.
                            Alterar este cadastro afeta todas as ocorrências.
                            Para pagamentos individuais, use lançamentos sem
                            recorrência.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  <label>
                    Observações
                    <textarea
                      maxLength={2000}
                      rows={2}
                      value={modal.notes}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Algum detalhe importante?"
                    />
                  </label>
                  {modal.kind !== "income" && (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={modal.review}
                        onChange={(e) => update("review", e.target.checked)}
                      />{" "}
                      Marcar para revisão de gastos
                    </label>
                  )}
                </>
              )
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              Cancelar
            </button>
            <button className={del ? "danger" : "primary"} disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : del ? (
                <Trash2 size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              {busy
                ? "Salvando…"
                : del
                  ? "Excluir lançamento"
                  : "Salvar lançamento"}
            </button>
          </div>
        </form>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  Icon,
  detail,
  dark = false,
}: {
  label: string;
  value: string;
  Icon: typeof Wallet;
  detail: string;
  dark?: boolean;
}) {
  return (
    <section className={"stat " + (dark ? "dark" : "")}>
      <div>
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>
        {dark && <span className="live-dot" />}
        {detail}
      </small>
      {dark && <div className="stat-decoration" />}
    </section>
  );
}
function PanelHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span className={"badge " + (status === "paid" ? "paid" : "pending")}>
      <i />
      {status === "paid" ? "Concluído" : "Pendente"}
    </span>
  );
}
function Empty({
  title,
  text,
  onClick,
}: {
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <div className="empty">
      <div>
        <Receipt size={24} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="text-button" onClick={onClick}>
        <Plus size={15} /> Adicionar lançamento
      </button>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
