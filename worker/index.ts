import { validate, type Entry } from "../src/finance";
import { calculatePricing } from "../src/pricing";
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
    ctx.waitUntil(dailyNotifications(env));
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
      if (url.pathname === "/api/pricing" && req.method === "GET") {
        const row = await env.DB.prepare(
          "SELECT data FROM pricing WHERE id=1",
        ).first<{ data: string }>();
        return json({ input: row ? JSON.parse(row.data) : null });
      }
      if (url.pathname === "/api/pricing" && req.method === "PUT") {
        const input = await req.json();
        try {
          calculatePricing(input as Parameters<typeof calculatePricing>[0]);
        } catch (e) {
          return json({ error: (e as Error).message }, 400);
        }
        await env.DB.prepare(
          "INSERT INTO pricing(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        )
          .bind(JSON.stringify(input))
          .run();
        return json({ ok: true });
      }
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
