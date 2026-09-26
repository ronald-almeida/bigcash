import webpush from "web-push";
import { buildAlerts } from "../src/notifications";
import { type Entry, today } from "../src/finance";
export interface NotificationEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
const reply = (d: unknown, status = 200) =>
  Response.json(d, { status, headers: { "Cache-Control": "no-store" } });
export async function readAlerts(env: NotificationEnv) {
  const [rows, reads] = await Promise.all([
    env.DB.prepare("SELECT data FROM entries").all<{ data: string }>(),
    env.DB.prepare("SELECT id FROM notification_reads").all<{ id: string }>(),
  ]);
  const seen = new Set(reads.results.map((x) => x.id));
  return buildAlerts(
    rows.results.map((x) => JSON.parse(x.data) as Entry),
    today(),
  ).map((a) => ({ ...a, read: seen.has(a.id) }));
}
export function validateSubscription(input: unknown): webpush.PushSubscription {
  const s = input as webpush.PushSubscription;
  let u: URL;
  try {
    u = new URL(s.endpoint);
  } catch {
    throw new Error("Endereço de push inválido.");
  }
  // Only browser push providers. Never accept arbitrary URLs for server-side requests.
  const host = u.hostname;
  const allowed =
    host === "fcm.googleapis.com" ||
    host === "updates.push.services.mozilla.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host === "web.push.apple.com" ||
    host.endsWith(".push.apple.com") ||
    host === "wns.windows.com" ||
    host.endsWith(".notify.windows.com");
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !allowed ||
    s.endpoint.length > 2048 ||
    !s.keys ||
    !/^[-_a-zA-Z0-9]{87}$/.test(s.keys.p256dh) ||
    !/^[-_a-zA-Z0-9]{22}$/.test(s.keys.auth)
  )
    throw new Error("Assinatura de notificação inválida.");
  return {
    endpoint: s.endpoint,
    keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
  };
}
export function pushConfigured(env: NotificationEnv) {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}
export async function sendPush(
  env: NotificationEnv,
  subscription: webpush.PushSubscription,
  data: { title: string; body: string; tag: string },
) {
  const request = webpush.generateRequestDetails(
    subscription,
    JSON.stringify(data),
    {
      TTL: 3600,
      urgency: "normal",
      contentEncoding: "aes128gcm",
      vapidDetails: {
        subject: env.VAPID_SUBJECT!,
        publicKey: env.VAPID_PUBLIC_KEY!,
        privateKey: env.VAPID_PRIVATE_KEY!,
      },
    },
  );
  const response = await fetch(request.endpoint, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body: request.body ? new Uint8Array(request.body) : undefined,
    redirect: "error",
  });
  if (response.status === 404 || response.status === 410) {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?")
      .bind(subscription.endpoint)
      .run();
    return false;
  }
  if (!response.ok) throw new Error(`Push provider status ${response.status}`);
  return true;
}
export async function notificationApi(
  req: Request,
  env: NotificationEnv,
): Promise<Response | null> {
  const path = new URL(req.url).pathname;
  if (path === "/api/notifications" && req.method === "GET")
    return reply({
      alerts: await readAlerts(env),
      pushConfigured: pushConfigured(env),
      publicKey: pushConfigured(env) ? env.VAPID_PUBLIC_KEY : null,
    });
  if (path === "/api/notifications/read" && req.method === "POST") {
    const body = (await req.json()) as { ids: string[] };
    if (
      !Array.isArray(body.ids) ||
      body.ids.length > 500 ||
      body.ids.some((id) => typeof id !== "string" || id.length > 200)
    )
      return reply({ error: "Lista inválida." }, 400);
    if (body.ids.length)
      await env.DB.batch(
        body.ids.map((id) =>
          env.DB.prepare(
            "INSERT OR IGNORE INTO notification_reads(id) VALUES(?)",
          ).bind(id),
        ),
      );
    return reply({ ok: true });
  }
  if (path === "/api/push/subscribe" && req.method === "POST") {
    if (!pushConfigured(env))
      return reply(
        {
          error:
            "As notificações push ainda precisam ser configuradas na hospedagem.",
        },
        503,
      );
    let s: webpush.PushSubscription;
    try {
      s = validateSubscription(await req.json());
    } catch (e) {
      return reply({ error: (e as Error).message }, 400);
    }
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM push_subscriptions",
    ).first<{ n: number }>();
    const exists = await env.DB.prepare(
      "SELECT endpoint FROM push_subscriptions WHERE endpoint=?",
    )
      .bind(s.endpoint)
      .first();
    if ((count?.n ?? 0) >= 25 && !exists)
      return reply({ error: "Limite de dispositivos atingido." }, 409);
    await env.DB.prepare(
      "INSERT INTO push_subscriptions(endpoint,data) VALUES(?,?) ON CONFLICT(endpoint) DO UPDATE SET data=excluded.data",
    )
      .bind(s.endpoint, JSON.stringify(s))
      .run();
    return reply({ ok: true });
  }
  if (path === "/api/push/unsubscribe" && req.method === "POST") {
    const body = (await req.json()) as { endpoint: string };
    if (typeof body.endpoint !== "string")
      return reply({ error: "Dispositivo inválido." }, 400);
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?")
      .bind(body.endpoint)
      .run();
    return reply({ ok: true });
  }
  if (path === "/api/push/test" && req.method === "POST") {
    if (!pushConfigured(env))
      return reply({ error: "Push não configurado na hospedagem." }, 503);
    const body = (await req.json()) as { endpoint: string };
    if (typeof body.endpoint !== "string")
      return reply({ error: "Dispositivo inválido." }, 400);
    const row = await env.DB.prepare(
      "SELECT data,last_test FROM push_subscriptions WHERE endpoint=?",
    )
      .bind(body.endpoint)
      .first<{ data: string; last_test: number }>();
    if (!row)
      return reply(
        { error: "Ative as notificações neste dispositivo primeiro." },
        404,
      );
    const claim = await env.DB.prepare(
      "UPDATE push_subscriptions SET last_test=? WHERE endpoint=? AND last_test<?",
    )
      .bind(Date.now(), body.endpoint, Date.now() - 60000)
      .run();
    if (!claim.meta.changes)
      return reply(
        { error: "Aguarde um minuto antes de testar novamente." },
        429,
      );
    const sent = await sendPush(env, JSON.parse(row.data), {
      title: "BigCash conectado",
      body: "Seu dispositivo está pronto para receber alertas e o resumo diário.",
      tag: "bigcash-test",
    });
    return sent
      ? reply({ ok: true })
      : reply(
          { error: "Assinatura expirada. Desative e ative novamente." },
          410,
        );
  }
  return null;
}
export async function dailyNotifications(env: NotificationEnv) {
  if (!pushConfigured(env)) return;
  const date = today();
  const alerts = await readAlerts(env);
  const overdue = alerts.filter((x) => x.kind === "overdue").length;
  const due = alerts.filter((x) => x.kind === "due").length;
  const upcoming = alerts.filter((x) => x.kind === "upcoming").length;
  const body =
    overdue + due + upcoming
      ? `${overdue} pendência(s) em atraso, ${due} vencimento(s) hoje e ${upcoming} nos próximos 3 dias. Abra o BigCash para revisar.`
      : "Nenhum vencimento pendente nos próximos 3 dias. Abra o BigCash para acompanhar seu financeiro.";
  const devices = await env.DB.prepare(
    "SELECT endpoint,data FROM push_subscriptions WHERE last_sent_day IS NULL OR last_sent_day<>? LIMIT 25",
  )
    .bind(date)
    .all<{ endpoint: string; data: string }>();
  for (const device of devices.results) {
    const claimed = await env.DB.prepare(
      "UPDATE push_subscriptions SET last_sent_day=? WHERE endpoint=? AND (last_sent_day IS NULL OR last_sent_day<>?)",
    )
      .bind(date, device.endpoint, date)
      .run();
    if (!claimed.meta.changes) continue;
    try {
      await sendPush(env, JSON.parse(device.data), {
        title: "Seu resumo diário · BigCash",
        body,
        tag: "bigcash-daily-" + date,
      });
    } catch (error) {
      await env.DB.prepare(
        "UPDATE push_subscriptions SET last_sent_day=NULL WHERE endpoint=? AND last_sent_day=?",
      )
        .bind(device.endpoint, date)
        .run();
      console.error("Daily push delivery failed", String(error));
    }
  }
}
