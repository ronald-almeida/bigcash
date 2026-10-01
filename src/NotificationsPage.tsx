import { useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCheck,
  Download,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { type FinanceAlert } from "./notifications";
import type { Kind } from "./finance";
export async function registerWorker() {
  if (!("serviceWorker" in navigator))
    throw new Error("Este navegador não suporta o aplicativo instalado.");
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}
async function request(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await r.json()) as {
    error?: string;
    alerts: FinanceAlert[];
    pushConfigured: boolean;
    publicKey: string | null;
  };
  if (!r.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}
function keyBytes(key: string) {
  const value = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(value, (c) => c.charCodeAt(0));
}
export function Notifications({
  navigate,
  onUnreadChange,
}: {
  navigate: (page: Kind) => void;
  onUnreadChange: (n: number) => void;
}) {
  const [alerts, setAlerts] = useState<FinanceAlert[]>([]);
  const [publicKey, setPublicKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const supported =
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  const load = async () => {
    setError("");
    try {
      const data = await request("notifications");
      setAlerts(data.alerts);
      setConfigured(data.pushConfigured);
      setPublicKey(data.publicKey || "");
      if ("serviceWorker" in navigator) {
        const reg = await registerWorker();
        if ("pushManager" in reg) {
          const sub = await reg.pushManager.getSubscription();
          // Restore server registration if it was removed or a prior save failed.
          if (sub && data.pushConfigured)
            await request("push/subscribe", sub.toJSON());
          setSubscription(sub);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    onUnreadChange(alerts.filter((a) => !a.read).length);
  }, [alerts, onUnreadChange]);
  const enable = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Permission must be requested synchronously from the user's click on iOS.
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "Permissão não concedida. Ative as notificações nos ajustes do dispositivo para tentar novamente.",
        );
      await registerWorker();
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub)
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        });
      await request("push/subscribe", sub.toJSON());
      setSubscription(sub);
      setMessage(
        "Notificações ativadas. Resumo diário às 9h (horário da Bahia).",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      await request("push/unsubscribe", { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      setSubscription(null);
      setMessage("Notificações desativadas neste dispositivo.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const mark = async (ids: string[]) => {
    setBusy(true);
    try {
      await request("notifications/read", { ids: ids.slice(0, 500) });
      setAlerts((a) =>
        a.map((x) =>
          ids.slice(0, 500).includes(x.id) ? { ...x, read: true } : x,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="notifications-layout">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Central de notificações</h2>
            <p>
              {alerts.filter((a) => !a.read).length} não lida(s) · Vencimentos,
              pendências e revisões
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Atualizar notificações"
            disabled={busy}
            onClick={load}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="notification-toolbar">
          <button
            className="secondary"
            disabled={busy || !alerts.some((a) => !a.read)}
            onClick={() => mark(alerts.filter((a) => !a.read).map((a) => a.id))}
          >
            <CheckCheck size={16} />
            Marcar como lidas
          </button>
        </div>
        {loading ? (
          <p className="empty">Carregando notificações…</p>
        ) : alerts.length ? (
          <ul className="alert-list">
            {alerts.map((a) => (
              <li key={a.id} className={a.read ? "read" : ""}>
                <span className={"alert-symbol " + a.kind}>
                  <Bell size={18} />
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.body}</p>
                  <div className="alert-actions">
                    <button
                      className="text-button"
                      onClick={() => navigate(a.entryKind)}
                    >
                      Ver lançamento
                    </button>
                    {!a.read && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => mark([a.id])}
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                </div>
                {!a.read && <i className="unread-dot" />}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <Bell size={28} />
            <h3>Tudo em dia por aqui</h3>
            <p>
              As contas pendentes, vencimentos em até 3 dias e gastos para
              revisão aparecem aqui.
            </p>
          </div>
        )}
      </section>
      <div className="notification-options">
        <section className="panel install-card">
          <Smartphone size={26} />
          <h2>BigCash no seu iPhone</h2>
          {standalone ? (
            <p className="success-note">
              Você já está usando o aplicativo instalado.
            </p>
          ) : (
            <ol>
              <li>Abra o endereço publicado do BigCash no Safari.</li>
              <li>
                Toque em <strong>Compartilhar</strong> e depois em{" "}
                <strong>Adicionar à Tela de Início</strong>.
              </li>
              <li>
                Abra o BigCash pelo novo ícone e ative as notificações abaixo.
              </li>
            </ol>
          )}
          <p className="field-help">
            Notificações no iPhone exigem iOS 16.4 ou superior, aplicativo
            instalado e site publicado com HTTPS. Dados financeiros precisam de
            conexão.
          </p>
        </section>
        <section className="panel install-card">
          <Bell size={25} />
          <h2>Receba os avisos no dispositivo</h2>
          <p>
            Resumo diário às <strong>9h</strong> com vencimentos de hoje,
            pendências em atraso e próximos 3 dias. Os valores financeiros não
            são exibidos na tela bloqueada.
          </p>
          {!configured && (
            <div className="info-note">
              A central funciona aqui. Para receber avisos com o app fechado,
              falta concluir a publicação e configurar as chaves de notificação
              no servidor.
            </div>
          )}
          {ios && !standalone && (
            <p className="field-help">
              Instale e abra pela tela inicial para ativar.
            </p>
          )}
          {!supported && (
            <p className="field-help">
              Push não está disponível neste navegador. A central de
              notificações continua funcionando.
            </p>
          )}
          <button
            className={subscription ? "secondary" : "primary"}
            disabled={
              busy ||
              !supported ||
              (!subscription && (!configured || !!(ios && !standalone)))
            }
            onClick={subscription ? disable : enable}
          >
            {subscription ? <BellOff size={17} /> : <Bell size={17} />}{" "}
            {busy
              ? "Aguarde…"
              : subscription
                ? "Desativar neste dispositivo"
                : "Ativar notificações"}
          </button>
          {subscription && (
            <button
              className="secondary"
              disabled={busy || !configured}
              onClick={async () => {
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  await request("push/subscribe", subscription.toJSON());
                  await request("push/test", {
                    endpoint: subscription.endpoint,
                  });
                  setMessage(
                    "Teste aceito pelo serviço de notificações. Confira o dispositivo; se não aparecer, revise as permissões do navegador e o modo Foco/Não perturbe.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enviar notificação de teste
            </button>
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
        </section>
      </div>
    </div>
  );
}
