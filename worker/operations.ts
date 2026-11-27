import { initialState, validateState, type State } from "../src/operations.ts";
import { parseStatement } from "../src/statements.ts";

const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const digest = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
export async function readWorkspace(db: D1Database) {
  await db
    .prepare(
      "INSERT OR IGNORE INTO finance_workspace(id,version,data,request_id,request_hash,reason) VALUES(1,0,?,'initial','','Inicialização sem lançamentos')",
    )
    .bind(JSON.stringify(initialState()))
    .run();
  const row = await db
    .prepare("SELECT version,data FROM finance_workspace WHERE id=1")
    .first<{ version: number; data: string }>();
  if (!row) throw Error("Workspace financeiro indisponível.");
  const value = JSON.parse(row.data);
  if (value.chunked) {
    const parts = await db
      .prepare(
        "SELECT data FROM finance_snapshots WHERE version=? ORDER BY part",
      )
      .bind(row.version)
      .all<{ data: string }>();
    if (parts.results.length !== value.parts)
      throw Error("Revisão incompleta; restaure o backup verificado.");
    return {
      version: row.version,
      state: JSON.parse(parts.results.map((x) => x.data).join("")) as State,
    };
  }
  return { version: row.version, state: value as State };
}
async function save(
  db: D1Database,
  body: { version: number; requestId: string; reason: string; state: State },
  requestHash: string,
) {
  if (
    !Number.isSafeInteger(body.version) ||
    body.version < 0 ||
    typeof body.requestId !== "string" ||
    !/^[\w-]{16,80}$/.test(body.requestId) ||
    typeof body.reason !== "string" ||
    !body.reason.trim() ||
    body.reason.length > 500
  )
    return reply(
      { error: "Informe versão, identificador e motivo da alteração." },
      400,
    );
  const prior = await db
    .prepare(
      "SELECT version,request_hash FROM finance_audit WHERE request_id=?",
    )
    .bind(body.requestId)
    .first<{ version: number; request_hash: string }>();
  if (prior)
    return prior.request_hash === requestHash
      ? reply({ ...(await readWorkspace(db)), replayed: true })
      : reply(
          { error: "Identificador já utilizado para outro conteúdo." },
          409,
        );
  const current = await readWorkspace(db);
  if (body.version !== current.version)
    return reply(
      {
        error:
          "Outro acesso alterou os dados. Recarregue antes de salvar; sua edição não foi aplicada.",
      },
      409,
    );
  const state = validateState(body.state, current.state);
  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).length > 12000000)
    return reply(
      {
        error:
          "Workspace excede 12 MB. Exporte o histórico e solicite expansão da paginação antes de continuar; nenhum dado foi descartado.",
      },
      413,
    );
  const chunks = serialized.match(/.{1,15000}/gsu)!;
  const statements = chunks.map((data, part) =>
    db
      .prepare(
        "INSERT INTO finance_snapshots(version,part,data) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM finance_workspace WHERE id=1 AND version=?)",
      )
      .bind(current.version + 1, part, data, current.version),
  );
  statements.push(
    db
      .prepare(
        "UPDATE finance_workspace SET data=?,version=version+1,request_id=?,request_hash=?,reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND version=?",
      )
      .bind(
        JSON.stringify({ chunked: true, parts: chunks.length }),
        body.requestId,
        requestHash,
        body.reason,
        current.version,
      ),
  );
  const results = await db.batch(statements);
  const result = results[results.length - 1];
  // D1 counts audit-trigger writes as changes too; only zero means CAS failed.
  if (!result.meta.changes)
    return reply(
      { error: "Conflito de versão. Recarregue para continuar." },
      409,
    );
  return reply({ version: current.version + 1, state });
}
export async function operationsApi(
  req: Request,
  db: D1Database,
): Promise<Response | null> {
  const path = new URL(req.url).pathname;
  if (!path.startsWith("/api/operations")) return null;
  try {
    if (path === "/api/operations" && req.method === "GET") {
      const [current, legacy, settings] = await Promise.all([
        readWorkspace(db),
        db
          .prepare("SELECT data FROM entries ORDER BY created_at")
          .all<{ data: string }>(),
        db
          .prepare("SELECT opening_balance FROM settings WHERE id=1")
          .first<{ opening_balance: number }>(),
      ]);
      return reply({
        ...current,
        legacy: legacy.results.map((x) => JSON.parse(x.data)),
        legacyOpening: settings?.opening_balance ?? null,
      });
    }
    if (path === "/api/operations/audit" && req.method === "GET") {
      const before = Number(
        new URL(req.url).searchParams.get("before") || Number.MAX_SAFE_INTEGER,
      );
      const rows = await db
        .prepare(
          "SELECT version,request_id,reason,actor,created_at FROM finance_audit WHERE version < ? ORDER BY version DESC LIMIT 100",
        )
        .bind(before)
        .all();
      return reply({ history: rows.results });
    }
    if (/^\/api\/operations\/audit\/\d+$/.test(path) && req.method === "GET") {
      const version = Number(path.split("/").pop());
      const audit = await db
        .prepare("SELECT * FROM finance_audit WHERE version=?")
        .bind(version)
        .first();
      if (!audit) return reply({ error: "Revisão não encontrada." }, 404);
      const rows = await db
        .prepare(
          "SELECT data FROM finance_snapshots WHERE version=? ORDER BY part",
        )
        .bind(version)
        .all<{ data: string }>();
      return reply({
        audit,
        state: rows.results.length
          ? JSON.parse(rows.results.map((x) => x.data).join(""))
          : JSON.parse(String(audit.after_data)),
      });
    }
    if (path === "/api/operations/export" && req.method === "GET") {
      const [current, history, attachments, legacy, settings] =
        await Promise.all([
          readWorkspace(db),
          db.prepare("SELECT * FROM finance_audit ORDER BY version").all(),
          db
            .prepare(
              "SELECT id,campaign_id,name,mime,created_at FROM finance_attachments",
            )
            .all(),
          db.prepare("SELECT * FROM entries").all(),
          db.prepare("SELECT * FROM settings").all(),
        ]);
      return reply({
        format: "bigcash-operations-export-v1",
        ...current,
        history: history.results,
        attachments: attachments.results,
        legacy: legacy.results,
        legacySettings: settings.results,
        note: "Exportação para consulta. Anexos binários, sessões e demais tabelas exigem backup D1 completo.",
      });
    }
    if (path === "/api/operations/attachments" && req.method === "GET")
      return reply({
        attachments: (
          await db
            .prepare(
              "SELECT id,campaign_id,name,mime,created_at FROM finance_attachments ORDER BY created_at DESC",
            )
            .all()
        ).results,
      });
    if (
      path.startsWith("/api/operations/attachments/") &&
      req.method === "GET"
    ) {
      const row = await db
        .prepare("SELECT name,mime,data FROM finance_attachments WHERE id=?")
        .bind(path.split("/").pop())
        .first<{ name: string; mime: string; data: ArrayBuffer }>();
      return row
        ? new Response(new Uint8Array(row.data), {
            headers: {
              "Content-Type": row.mime,
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'",
            },
          })
        : reply({ error: "Comprovante não encontrado." }, 404);
    }
    if (req.method === "POST" && path === "/api/operations/attachments") {
      if (Number(req.headers.get("Content-Length") ?? 0) > 2100000)
        return reply({ error: "Limite de 2 MB por comprovante." }, 413);
      const form = await req.formData();
      const file = form.get("file");
      const campaignId = String(form.get("campaignId"));
      if (
        !(file instanceof File) ||
        file.size > 1900000 ||
        !["application/pdf", "image/png", "image/jpeg"].includes(file.type)
      )
        return reply({ error: "Envie PDF, PNG ou JPEG com até 1,9 MB." }, 400);
      const current = await readWorkspace(db);
      if (!current.state.campaigns.some((c) => c.id === campaignId))
        return reply({ error: "Campanha não encontrada." }, 404);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature =
        file.type === "application/pdf"
          ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
          : file.type === "image/png"
            ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
            : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!signature)
        return reply(
          { error: "Formato do arquivo não corresponde ao conteúdo." },
          400,
        );
      const key = await digest(campaignId + ":" + Array.from(bytes).join(","));
      await db
        .prepare(
          "INSERT OR IGNORE INTO finance_attachments(id,campaign_id,name,mime,data) VALUES(?,?,?,?,?)",
        )
        .bind(key, campaignId, file.name.slice(0, 180), file.type, bytes)
        .run();
      return reply({ id: key });
    }
    if (req.method === "PUT" && path === "/api/operations") {
      const raw = await req.text();
      if (raw.length > 12000000)
        return reply({ error: "Limite de dados excedido." }, 413);
      const body = JSON.parse(raw);
      const current = await readWorkspace(db);
      if (
        !body.state ||
        body.state.imports?.length !== current.state.imports.length ||
        body.state.statements?.length !== current.state.statements.length
      )
        return reply(
          {
            error:
              "Utilize a importação de extrato para acrescentar movimentos bancários.",
          },
          400,
        );
      // A client cannot fabricate conversion links to hide preserved history.
      const legacy = await db
        .prepare("SELECT data FROM entries")
        .all<{ data: string }>();
      const legacyIds = new Set(
        legacy.results.map((x) => JSON.parse(x.data).id),
      );
      if (
        body.state.entries?.some(
          (e: { legacyKey: string }) =>
            e.legacyKey && !legacyIds.has(e.legacyKey.split("|")[0]),
        )
      )
        return reply({ error: "Origem legada não encontrada." }, 400);
      return await save(db, body, await digest(raw));
    }
    if (req.method === "POST" && path === "/api/operations/import") {
      const rawRequest = await req.text();
      if (rawRequest.length > 2200000)
        return reply({ error: "Arquivo excede 2 MB." }, 413);
      const body = JSON.parse(rawRequest) as {
        accountId: string;
        raw: string;
        name: string;
        version: number;
        requestId: string;
      };
      const current = await readWorkspace(db);
      if (
        !current.state.accounts.some(
          (a) => a.id === body.accountId && a.kind === "bank",
        )
      )
        return reply({ error: "Selecione a conta bancária do extrato." }, 400);
      if (typeof body.raw !== "string" || typeof body.name !== "string")
        return reply({ error: "Arquivo inválido." }, 400);
      const hash = await digest(body.raw);
      if (
        current.state.imports.some(
          (b) => b.hash === hash && b.accountId === body.accountId,
        )
      )
        return reply({
          ...current,
          duplicates: 0,
          message: "Arquivo já importado; nenhum movimento acrescentado.",
        });
      const rows = parseStatement(body.raw);
      const batchId = crypto.randomUUID();
      let duplicates = 0;
      const existing = new Set(
        current.state.statements
          .filter((r) => r.accountId === body.accountId)
          .map((r) => r.externalId || r.fingerprint),
      );
      const occurrence = new Map<string, number>();
      for (const row of rows) {
        const signature = `${row.date}|${row.amount}|${row.memo.trim().toLowerCase()}`;
        const position = (occurrence.get(signature) ?? 0) + 1;
        occurrence.set(signature, position);
        const fingerprint = await digest(signature + "|" + position);
        const key = row.externalId || fingerprint;
        if (existing.has(key)) {
          duplicates++;
          continue;
        }
        existing.add(key);
        current.state.statements.push({
          ...row,
          id: crypto.randomUUID(),
          accountId: body.accountId,
          fingerprint,
          batchId,
          matches: [],
        });
      }
      current.state.imports.push({
        id: batchId,
        accountId: body.accountId,
        name: body.name,
        hash,
        importedAt: new Date().toISOString(),
        raw: body.raw,
      });
      const result = await save(
        db,
        {
          version: body.version,
          requestId: body.requestId,
          reason: `Importação ${body.name}; ${duplicates} duplicidades ignoradas`,
          state: current.state,
        },
        await digest(rawRequest),
      );
      if (!result.ok) return result;
      return reply({ ...((await result.json()) as object), duplicates });
    }
    return reply({ error: "Rota não encontrada." }, 404);
  } catch (error) {
    return reply(
      { error: error instanceof Error ? error.message : "Dados inválidos." },
      400,
    );
  }
}

