// Run only against an isolated local Wrangler database. Never accepts a remote URL.
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:8787";
let cookie = "";
let checks = 0;
async function request(
  path,
  method = "GET",
  body,
  expected = 200,
  csrf = true,
) {
  const response = await fetch(origin + "/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(csrf ? { Origin: origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${await response.clone().text()}`,
  );
  checks++;
  if (response.headers.get("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return response.json();
}
await request("operations", "GET", undefined, 401);
await request("login", "POST", { password: "wrong" }, 401);
await request("login", "POST", { password: "bigcash-local-test-only" });
await request("operations", "PUT", {}, 403, false);
await request("entries", "POST", {}, 409);
let data = await request("operations");
assert.equal(
  data.state.entries.length,
  0,
  "Use a fresh isolated test database.",
);
const day = "2026-11-10";
const s = data.state;
s.accounts.push(
  {
    id: "test-bank",
    name: "TESTE · Banco",
    owner: "Fixture isolada",
    kind: "bank",
    availability: "available",
    opening: 100000,
    openingDate: day,
    source: "Teste de API",
    updatedAt: day,
    reserve: 10000,
  },
  {
    id: "test-wallet",
    name: "TESTE · Carteira",
    owner: "Fixture isolada",
    kind: "wallet",
    availability: "restricted",
    opening: 0,
    openingDate: day,
    source: "Teste de API",
    updatedAt: day,
    reserve: 0,
  },
);
s.campaigns.push({
  id: "test-campaign",
  name: "TESTE · campanha isolada",
  client: "",
  own: true,
  planned: null,
  performed: day,
  operational: "completed",
  financial: "review",
  expected: null,
  sent: null,
  delivered: 1028,
  failed: null,
  billed: null,
  hours: null,
  notes: "Fixture de teste, não é um lançamento real.",
  notApplicable: {},
  pricing: {
    mode: "message",
    basis: "delivered",
    unitMicros: 3000,
    fixed: 0,
    operationFee: 0,
    markupBps: 0,
    taxBps: 0,
    feesBps: 0,
    commissionBps: 0,
  },
});
s.settlements.push({
  id: "test-topup",
  kind: "topup",
  amount: 20000,
  date: day,
  accountId: "test-bank",
  targetId: "test-wallet",
  entryId: "",
  reversalOf: "",
  notes: "TESTE · recarga",
});
s.costs.push(
  {
    id: "test-consumption",
    campaignId: "test-campaign",
    source: "platform",
    status: "confirmed",
    amount: 7000,
    date: day,
    resourceId: "",
    walletId: "test-wallet",
    entryId: "",
    quantity: null,
    delivered: null,
    basis: "Extrato identificado do fornecedor",
    notes: "Fixture isolada",
  },
  {
    id: "test-meta",
    campaignId: "test-campaign",
    source: "meta",
    status: "pending",
    amount: null,
    date: null,
    resourceId: "",
    walletId: "",
    entryId: "",
    quantity: null,
    delivered: null,
    basis: "Cobrança pendente",
    notes: "",
  },
);
const first = {
  version: data.version,
  requestId: crypto.randomUUID(),
  reason: "Teste integrado: recarga e consumo",
  state: s,
};
data = await request("operations", "PUT", first);
assert.equal(data.version, 1);
assert.equal(data.state.costs[0].amount, 7000);
const repeated = await request("operations", "PUT", first);
assert.equal(repeated.replayed, true);
assert.equal(repeated.version, data.version);
await request(
  "operations",
  "PUT",
  { ...first, reason: "Conteúdo diferente" },
  409,
);
const invalid = structuredClone(data.state);
invalid.campaigns[0].financial = "closed";
await request(
  "operations",
  "PUT",
  {
    version: data.version,
    requestId: crypto.randomUUID(),
    reason: "Fechamento inválido",
    state: invalid,
  },
  400,
);
const file =
  "data;valor;descricao;id\n10/11/2026;-200,00;Recarga da carteira;bank-1";
data = await request("operations/import", "POST", {
  accountId: "test-bank",
  raw: file,
  name: "teste.csv",
  version: data.version,
  requestId: crypto.randomUUID(),
});
assert.equal(data.state.statements.length, 1);
const repeatFile = await request("operations/import", "POST", {
  accountId: "test-bank",
  raw: file,
  name: "renamed.csv",
  version: data.version,
  requestId: crypto.randomUUID(),
});
assert.equal(repeatFile.version, data.version);
assert.equal(repeatFile.state.statements.length, 1);
data = await request("operations/import", "POST", {
  accountId: "test-bank",
  raw: file + "\n",
  name: "same-movement.csv",
  version: data.version,
  requestId: crypto.randomUUID(),
});
assert.equal(data.duplicates, 1);
assert.equal(data.state.statements.length, 1);
data.state.statements[0].matches = [
  { settlementId: "test-topup", amount: 20000 },
];
data = await request("operations", "PUT", {
  version: data.version,
  requestId: crypto.randomUUID(),
  reason: "Conciliar recarga",
  state: data.state,
});
const before = data.version;
const attempts = await Promise.all(
  ["A", "B"].map(async (suffix) => {
    const result = await fetch(origin + "/api/operations", {
      method: "PUT",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: before,
        requestId: crypto.randomUUID(),
        reason: "Concorrência " + suffix,
        state: data.state,
      }),
    });
    return result.status;
  }),
);
assert.deepEqual(attempts.sort(), [200, 409]);
checks += 2;
data = await request("operations");
const deletion = structuredClone(data.state);
deletion.costs = [];
await request(
  "operations",
  "PUT",
  {
    version: data.version,
    requestId: crypto.randomUUID(),
    reason: "Exclusão proibida",
    state: deletion,
  },
  400,
);
data.state.entries.push({
  id: "test-meta-invoice",
  name: "TESTE · cobrança Meta",
  kind: "expense",
  amount: 5000,
  competence: day,
  due: "2026-11-20",
  campaignId: "test-campaign",
  client: "",
  shared: false,
  category: "Meta",
  notes: "Fixture",
  legacyKey: "",
});
data.state.costs[1] = {
  ...data.state.costs[1],
  status: "confirmed",
  amount: 5000,
  date: day,
  entryId: "test-meta-invoice",
};
data = await request("operations", "PUT", {
  version: data.version,
  requestId: crypto.randomUUID(),
  reason: "Cobrança Meta recebida",
  state: data.state,
});
const notifications = await request("notifications");
assert.equal(
  notifications.alerts.some((x) => x.title === "Campanha aguardando Meta"),
  false,
);
// Force a multi-chunk revision to verify reconstruction and transactional audit.
for (let i = 0; i < 20; i++)
  data.state.entries.push({
    id: "test-chunk-" + i,
    name: "TESTE · item " + i,
    kind: "expense",
    amount: 1,
    competence: day,
    due: day,
    campaignId: "",
    client: "",
    shared: false,
    category: "Teste de persistência",
    notes: "x".repeat(1800),
    legacyKey: "",
  });
data = await request("operations", "PUT", {
  version: data.version,
  requestId: crypto.randomUUID(),
  reason: "Persistência em múltiplos fragmentos",
  state: data.state,
});
const after = await request("operations");
assert.equal(after.state.entries.at(-1).notes.length, 1800);
assert.equal(after.version, data.version);
const audit = await request("operations/audit");
assert.equal(audit.history.length, data.version);
const revision = await request("operations/audit/" + data.version);
assert.equal(revision.state.entries.length, 21);
const form = new FormData();
form.set("campaignId", "test-campaign");
form.set(
  "file",
  new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
  "fixture.pdf",
);
const upload = await fetch(origin + "/api/operations/attachments", {
  method: "POST",
  headers: { Origin: origin, Cookie: cookie },
  body: form,
});
assert.equal(upload.status, 200);
checks++;
const attachment = await upload.json();
const download = await fetch(
  origin + "/api/operations/attachments/" + attachment.id,
  { headers: { Cookie: cookie } },
);
assert.equal(await download.text(), "%PDF-1.4\n%%EOF");
assert.match(download.headers.get("content-disposition"), /attachment/);
checks++;
const again = await fetch(origin + "/api/operations/attachments", {
  method: "POST",
  headers: { Origin: origin, Cookie: cookie },
  body: form,
});
assert.equal((await again.json()).id, attachment.id);
checks++;
const listed = await request("operations/attachments");
assert.equal(listed.attachments.length, 1);
await request("logout", "POST");
await request("operations", "GET", undefined, 401);
console.log(
  `${checks} API checks passed: login, CSRF, persistence, replay, concurrency, immutable history, pending Meta, import deduplication, reconciliation, chunked revisions, audit, authenticated attachments and logout.`,
);

