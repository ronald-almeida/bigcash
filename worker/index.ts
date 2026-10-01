import { monthlyHistory } from "./monthly";
import { today } from "../src/finance";
import { validate, validDate, type Entry } from "../src/finance";
import { installmentEntries } from "../src/installments";
import {
  notificationApi,
  dailyNotifications,
  type NotificationEnv,
} from "./notifications";
interface Env extends NotificationEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_PASSWORD: string;
}
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
export default {
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      Promise.all([monthlyHistory(env.DB), dailyNotifications(env)]),
    );
  },
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      if (!env.APP_PASSWORD)
        return json(
          { error: "O administrador precisa configurar a senha de acesso." },
          503,
        );
      if (req.method !== "GET" && req.headers.get("Origin") !== url.origin)
        return json({ error: "Origem não permitida." }, 403);
      const now = Date.now();
      const cookie = req.headers
        .get("Cookie")
        ?.match(/(?:^|; )bigcash_session=([^;]+)/)?.[1];
      if (url.pathname === "/api/login" && req.method === "POST") {
        const ip = req.headers.get("CF-Connecting-IP") || "local";
        const attempt = await env.DB.prepare(
          "SELECT attempts,reset_at FROM login_attempts WHERE ip=?",
        )
          .bind(ip)
          .first<{ attempts: number; reset_at: number }>();
        if (attempt && attempt.reset_at > now && attempt.attempts >= 10)
          return json({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);
        await env.DB.prepare(
          "INSERT INTO login_attempts(ip,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END",
        )
          .bind(ip, now + 900000, now, now)
          .run();
        const body = (await req.json()) as { password?: string };
        if (typeof body.password !== "string" || body.password.length > 500)
          return json({ error: "Senha inválida." }, 400);
        if ((await hash(body.password)) !== (await hash(env.APP_PASSWORD)))
          return json({ error: "Senha incorreta. Tente novamente." }, 401);
        const token = crypto.randomUUID() + crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare("DELETE FROM sessions WHERE expires<?").bind(now),
          env.DB.prepare(
            "INSERT INTO sessions(token,expires) VALUES(?,?)",
          ).bind(await hash(token), now + 86400000),
          env.DB.prepare("DELETE FROM login_attempts WHERE ip=?").bind(ip),
        ]);
        return json({ ok: true }, 200, {
          "Set-Cookie": `bigcash_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}`,
        });
      }
      const session =
        cookie &&
        (await env.DB.prepare(
          "SELECT token FROM sessions WHERE token=? AND expires>?",
        )
          .bind(await hash(cookie), now)
          .first());
      if (!session)
        return json({ error: "Entre para acessar suas finanças." }, 401);
      const notifications = await notificationApi(req, env);
      if (notifications) return notifications;
      if (url.pathname === "/api/monthly-goals" && req.method === "GET")
        return json({ months: await monthlyHistory(env.DB) });
      if (url.pathname === "/api/monthly-goals" && req.method === "PUT") {
        const body = (await req.json()) as {
          month: string;
          revenue_target: number;
          profit_target: number;
        };
        if (
          !body ||
          !validDate(body.month + "-01") ||
          ![body.revenue_target, body.profit_target].every(
            (n) => Number.isSafeInteger(n) && n >= 0 && n <= 100000000000,
          )
        )
          return json({ error: "Informe o mês e metas válidas." }, 400);
        if (body.month < today().slice(0, 7))
          return json(
            { error: "Meses encerrados preservam suas metas e resultados." },
            400,
          );
        await env.DB.prepare(
          "INSERT INTO monthly_goals(month,revenue_target,profit_target) VALUES(?,?,?) ON CONFLICT(month) DO UPDATE SET revenue_target=excluded.revenue_target,profit_target=excluded.profit_target WHERE monthly_goals.closed_at IS NULL",
        )
          .bind(body.month, body.revenue_target, body.profit_target)
          .run();
        return json({ ok: true });
      }
      if (req.method !== "GET") await monthlyHistory(env.DB);
      if (url.pathname === "/api/logout" && req.method === "POST") {
        await env.DB.prepare("DELETE FROM sessions WHERE token=?")
          .bind(await hash(cookie!))
          .run();
        return json({ ok: true }, 200, {
          "Set-Cookie":
            "bigcash_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        });
      }
      if (url.pathname === "/api/data" && req.method === "GET") {
        const rows = await env.DB.prepare(
          "SELECT data FROM entries ORDER BY created_at DESC",
        ).all<{ data: string }>();
        const settings = await env.DB.prepare(
          "SELECT opening_balance FROM settings WHERE id=1",
        ).first<{ opening_balance: number }>();
        return json({
          entries: rows.results.map((x) => JSON.parse(x.data)),
          openingBalance: settings?.opening_balance ?? 0,
        });
      }
      if (url.pathname === "/api/settings" && req.method === "PUT") {
        const body = (await req.json()) as { openingBalance: number };
        if (
          !Number.isSafeInteger(body.openingBalance) ||
          Math.abs(body.openingBalance) > 100000000000
        )
          return json({ error: "Saldo inválido." }, 400);
        await env.DB.prepare("UPDATE settings SET opening_balance=? WHERE id=1")
          .bind(body.openingBalance)
          .run();
        return json({ ok: true });
      }
      if (url.pathname === "/api/installments" && req.method === "POST") {
        let parts: Entry[];
        try {
          const body = (await req.json()) as {
            entry: unknown;
            count: number;
            requestId: string;
          };
          parts = installmentEntries(body.entry, body.count, body.requestId);
        } catch (e) {
          return json(
            {
              error: e instanceof Error ? e.message : "Parcelamento inválido.",
            },
            400,
          );
        }
        await env.DB.batch(
          parts.map((e) =>
            env.DB.prepare(
              "INSERT OR IGNORE INTO entries(id,data) VALUES(?,?)",
            ).bind(e.id, JSON.stringify(e)),
          ),
        );
        return json({ ok: true, count: parts.length });
      }
      if (url.pathname === "/api/entries" && req.method === "POST") {
        let e: Entry;
        try {
          e = validate(await req.json());
        } catch (err) {
          return json({ error: (err as Error).message }, 400);
        }
        if (
          e.id &&
          !(await env.DB.prepare("SELECT id FROM entries WHERE id=?")
            .bind(e.id)
            .first())
        )
          return json({ error: "Lançamento não encontrado." }, 404);
        if (e.kind === "fee") {
          const income = await env.DB.prepare(
            "SELECT id FROM entries WHERE id=? AND json_extract(data,'$.kind')='income'",
          )
            .bind(e.incomeId)
            .first();
          if (!income)
            return json({ error: "Selecione uma receita válida." }, 400);
        }
        if (e.id) {
          const old = await env.DB.prepare(
            "SELECT data FROM entries WHERE id=?",
          )
            .bind(e.id)
            .first<{ data: string }>();
          if (old && JSON.parse(old.data).kind !== e.kind)
            return json(
              { error: "O tipo de um lançamento não pode ser alterado." },
              400,
            );
        }
        e.id ||= crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO entries(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        )
          .bind(e.id, JSON.stringify(e))
          .run();
        return json({ entry: e });
      }
      if (url.pathname.startsWith("/api/entries/") && req.method === "DELETE") {
        const id = decodeURIComponent(
          url.pathname.slice("/api/entries/".length),
        );
        const used = await env.DB.prepare(
          "SELECT id FROM entries WHERE json_extract(data,'$.incomeId')=?",
        )
          .bind(id)
          .first();
        if (used)
          return json(
            {
              error:
                "Exclua as taxas vinculadas antes de excluir esta receita.",
            },
            409,
          );
        await env.DB.prepare("DELETE FROM entries WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
      return json({ error: "Rota não encontrada." }, 404);
    } catch (err) {
      console.error("API failure", err);
      return json(
        { error: "Não foi possível concluir. Tente novamente." },
        500,
      );
    }
  },
};
