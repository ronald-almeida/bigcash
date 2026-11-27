import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  emptyPrice,
  validateState,
  campaignTotals,
  accountBalance,
  dre,
  assigned,
  stock,
  splitCents,
  mulDiv,
  simulate,
  outstanding,
  forecast,
  type State,
  type Campaign,
  type Cost,
  type Entry,
  type Resource,
  type Settlement,
} from "../src/operations.ts";
import { parseStatement } from "../src/statements.ts";
// Dates/identifiers below belong exclusively to synthetic test fixtures, never production seeds.
const day = "2026-11-10";
const campaign = (id = "campaign", own = true): Campaign => ({
  id,
  name: "Cenário de teste",
  client: own ? "" : "Cliente teste",
  own,
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
  notes: "Fixture isolada",
  notApplicable: {},
  pricing: emptyPrice(),
});
const entry = (
  id: string,
  kind: Entry["kind"],
  amount: number,
  campaignId = "",
): Entry => ({
  id,
  name: id,
  kind,
  amount,
  competence: day,
  due: day,
  campaignId,
  client: "",
  shared: false,
  category: "Teste",
  notes: "",
  legacyKey: "",
});
const resource = (
  id: string,
  kind: Resource["kind"],
  amount: number,
): Resource => ({
  id,
  name: id,
  kind,
  amount,
  acquired: day,
  quantity: 1,
  limit: 250,
  status: "in_use",
  ended: null,
  reason: "",
  policy: "Distribuição manual explícita",
  recoveredStatement: "",
  entryId: "",
});
const cost = (
  id: string,
  source: Cost["source"],
  amount: number | null,
  extra: Partial<Cost> = {},
): Cost => ({
  id,
  campaignId: "campaign",
  source,
  status: "confirmed",
  amount,
  date: day,
  resourceId: "",
  walletId: "",
  entryId: "",
  quantity: null,
  delivered: null,
  basis: "Distribuição manual documentada",
  notes: "",
  ...extra,
});
const settlement = (
  id: string,
  kind: Settlement["kind"],
  amount: number,
  extra: Partial<Settlement> = {},
): Settlement => ({
  id,
  kind,
  amount,
  date: day,
  accountId: "bank",
  targetId: "",
  entryId: "",
  reversalOf: "",
  notes: "",
  ...extra,
});
function base(): State {
  const s = initialState();
  s.campaigns.push(campaign());
  s.accounts.push(
    {
      id: "bank",
      name: "Banco teste",
      owner: "Fixture",
      kind: "bank",
      availability: "available",
      opening: 100000,
      openingDate: day,
      source: "Teste",
      updatedAt: day,
      reserve: 10000,
    },
    {
      id: "wallet",
      name: "Carteira teste",
      owner: "Fixture",
      kind: "wallet",
      availability: "restricted",
      opening: 0,
      openingDate: day,
      source: "Teste",
      updatedAt: day,
      reserve: 0,
    },
  );
  return s;
}
test("reference campaign: 91 direct, 16.28 allocation, 107.28 partial, 0.1044 per delivery; pending Meta and reusable resources", () => {
  const s = base();
  s.resources.push(
    resource("bm40", "bm", 4000),
    resource("bm600", "bm", 60000),
    { ...resource("chips", "chip", 3000), quantity: 2 },
  );
  s.resources[0].status = "closed";
  s.resources[0].ended = day;
  s.resources[0].reason = "Encerrada após o disparo";
  s.resources[1].recoveredStatement =
    "Investimento recuperado segundo usuário; histórico não fornecido";
  s.costs.push(
    cost("bm40use", "bm", 4000, { resourceId: "bm40", delivered: 218 }),
    cost("bm600use", "bm", null, {
      resourceId: "bm600",
      delivered: 810,
      status: "pending",
    }),
    cost("chipsuse", "chip", 3000, { resourceId: "chips", quantity: 2 }),
    cost("p1", "platform", 1620, { walletId: "wallet" }),
    cost("p2", "platform", 480, { walletId: "wallet" }),
    cost("meta", "meta", null, { status: "pending" }),
    cost("shared", "shared", mulDiv(47500, 1028, 30000), {
      status: "estimated",
    }),
  );
  s.settlements.push(
    settlement("topup", "topup", 20000, { targetId: "wallet" }),
  );
  validateState(s);
  const t = campaignTotals(s, s.campaigns[0]);
  assert.equal(t.direct, 9100);
  assert.equal(t.shared, 1628);
  assert.equal(t.total, 10728);
  assert.equal((t.deliveredUnit! / 100).toFixed(4), "0.1044");
  assert.equal((4000 / 218 / 100).toFixed(4), "0.1835");
  assert.equal(t.complete, false);
  assert.equal(t.revenue, null);
  assert.equal(assigned(s, "bm600"), 0);
  assert.equal(s.resources[1].amount, 60000);
  assert.equal(stock(s, s.resources[2]), 0);
  assert.equal(simulate(s, s.campaigns[0]).complete, false);
  assert.equal(dre(s, day, day).result, -9100);
});
test("topup 200 and consumption 70 => wallet 130, single cost 70, internal transfer is not income", () => {
  const s = base();
  s.settlements.push(
    settlement("topup", "topup", 20000, { targetId: "wallet" }),
  );
  s.costs.push(cost("consumption", "platform", 7000, { walletId: "wallet" }));
  validateState(s);
  assert.equal(accountBalance(s, s.accounts[1], day), 13000);
  assert.equal(accountBalance(s, s.accounts[0], day), 80000);
  assert.equal(dre(s, day, day).expenses, 0);
  assert.equal(dre(s, day, day).consumption, 7000);
  assert.equal(dre(s, day, day).revenue, 0);
  assert.equal(forecast(s, day, day, day).length, 0);
});
test("Meta pending keeps operation complete and financial open; later invoice updates result once", () => {
  const s = base();
  s.campaigns[0].notApplicable = {
    bm: "Não usado",
    chip: "Não usado",
    profile: "Não usado",
    work: "Não aplicável",
    shared: "Uso exclusivo sem estrutura",
    platform: "Não usada",
  };
  s.costs.push(cost("meta", "meta", null, { status: "pending" }));
  s.campaigns[0].financial = "closed";
  assert.throws(() => validateState(s), /Fechamento/);
  s.campaigns[0].financial = "review";
  validateState(s);
  const old = structuredClone(s);
  s.entries.push(entry("invoice", "expense", 5000, "campaign"));
  s.costs[0] = {
    ...s.costs[0],
    status: "confirmed",
    amount: 5000,
    entryId: "invoice",
  };
  s.campaigns[0].financial = "closed";
  validateState(s, old);
  assert.equal(campaignTotals(s, s.campaigns[0]).total, 5000);
  assert.equal(dre(s, day, day).result, -5000);
  assert.equal(campaignTotals(s, s.campaigns[0]).result, null);
});
test("reused BM caps lifetime allocations and writes off only remainder, without inferred lifespan", () => {
  const s = base();
  s.campaigns.push(campaign("second"));
  s.resources.push(resource("bm", "bm", 60000));
  s.costs.push(
    cost("use1", "bm", 12000, { resourceId: "bm" }),
    cost("use2", "bm", 18000, { campaignId: "second", resourceId: "bm" }),
  );
  validateState(s);
  assert.equal(assigned(s, "bm"), 30000);
  s.resources[0] = {
    ...s.resources[0],
    status: "closed",
    ended: day,
    reason: "Encerrada",
  };
  assert.throws(() => validateState(s), /saldo de aquisição/);
  s.writeOffs.push({
    id: "loss",
    resourceId: "bm",
    amount: 30000,
    date: day,
    reason: "Perda residual",
  });
  validateState(s);
  assert.equal(dre(s, day, day).result, -60000);
  s.writeOffs[0].amount = 30001;
  assert.throws(() => validateState(s), /excede a aquisição/);
});
test("multiple chips and resources cannot overconsume inventory or duplicate acquisition", () => {
  const s = base();
  s.resources.push({ ...resource("chips", "chip", 4500), quantity: 3 });
  s.costs.push(
    cost("used", "chip", 3000, { resourceId: "chips", quantity: 2 }),
  );
  validateState(s);
  assert.equal(stock(s, s.resources[0]), 1);
  s.costs.push(
    cost("extra", "chip", 3000, { resourceId: "chips", quantity: 2 }),
  );
  assert.throws(() => validateState(s), /aquisição|chips suficientes/);
});
test("shared allocation includes own campaigns and is never doubled in consolidated DRE", () => {
  const s = base();
  s.campaigns.push(campaign("client", false));
  s.entries.push({ ...entry("structure", "expense", 47500), shared: true });
  const portions = splitCents(47500, [1028, 28972]);
  s.costs.push(
    cost("own-share", "shared", portions[0], { entryId: "structure" }),
    cost("client-share", "shared", portions[1], {
      campaignId: "client",
      entryId: "structure",
    }),
  );
  validateState(s);
  assert.equal(sumNumbers(portions), 47500);
  assert.equal(dre(s, day, day).result, -47500);
  assert.equal(dre(s, day, day, new Set(["campaign"])).result, -1628);
  assert.deepEqual(splitCents(100, [1, 1, 1]), [34, 33, 33]);
  assert.throws(() => splitCents(10, [0, 0]));
});
function sumNumbers(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}
test("markup differs from revenue margin; unknown quantity and pending costs do not imply viable price", () => {
  const s = base();
  s.entries.push(entry("work", "expense", 10000, "campaign"));
  s.costs.push(cost("labor", "work", 10000, { entryId: "work" }));
  s.campaigns[0].notApplicable = {
    meta: "Não usa",
    platform: "Não usa",
    bm: "Não usa",
    chip: "Não usa",
    profile: "Não usa",
    shared: "Exclusivo",
  };
  s.campaigns[0].pricing = { ...emptyPrice(), mode: "markup", markupBps: 2500 };
  validateState(s);
  const p = simulate(s, s.campaigns[0]);
  assert.equal(p.revenue, 12500);
  assert.equal(p.result, 2500);
  assert.equal(p.margin, 0.2);
  assert.equal(p.complete, true);
  s.campaigns[0].pricing.mode = "message";
  s.campaigns[0].delivered = null;
  assert.equal(simulate(s, s.campaigns[0]).complete, false);
  assert.equal(simulate(s, s.campaigns[0]).revenue, null);
});
test("partial payments and refunds preserve original cash and due balance", () => {
  const s = base();
  s.entries.push(entry("bill", "expense", 10000));
  s.settlements.push(
    settlement("partial", "payment", 4000, { entryId: "bill" }),
  );
  validateState(s);
  assert.equal(outstanding(s, s.entries[0]), 6000);
  s.settlements.push(
    settlement("refund", "refund", 1500, {
      entryId: "bill",
      reversalOf: "partial",
    }),
  );
  validateState(s);
  assert.equal(outstanding(s, s.entries[0]), 7500);
  assert.equal(accountBalance(s, s.accounts[0], day), 97500);
  assert.equal(dre(s, day, day).result, -10000);
  const old = structuredClone(s);
  s.settlements[0].amount = 5000;
  assert.throws(() => validateState(s, old), /imutáveis/);
});
test("receipts apportioned to BMs cannot credit full revenue repeatedly", () => {
  const s = base();
  s.entries.push(entry("revenue", "income", 30000, "campaign"));
  s.resources.push(resource("a", "bm", 4000), resource("b", "bm", 60000));
  s.costs.push(
    cost("a-use", "bm", 4000, { resourceId: "a" }),
    cost("b-use", "bm", 1000, { resourceId: "b" }),
  );
  s.revenueShares.push(
    {
      id: "share-a",
      campaignId: "campaign",
      resourceId: "a",
      amount: 10000,
      basis: "Entregas",
    },
    {
      id: "share-b",
      campaignId: "campaign",
      resourceId: "b",
      amount: 20000,
      basis: "Entregas",
    },
  );
  validateState(s);
  s.revenueShares[1].amount = 30000;
  assert.throws(() => validateState(s), /excede a receita/);
});
test("unknown account balance is never converted to opening zero; reserve is not added", () => {
  const s = base();
  s.accounts[0].opening = null;
  s.accounts[0].openingDate = null;
  validateState(s);
  assert.equal(accountBalance(s, s.accounts[0], day), null);
  s.accounts[0].opening = 100000;
  s.accounts[0].openingDate = day;
  assert.equal(accountBalance(s, s.accounts[0], day), 100000);
});
test("standalone expense linked to campaign is included without requiring a duplicate cost row", () => {
  const s = base();
  s.entries.push(entry("expense", "expense", 1000, "campaign"));
  assert.equal(campaignTotals(s, s.campaigns[0]).total, 1000);
});
test("CSV/OFX preserve raw values, support cents and quotes, and reject malformed dates/currencies", () => {
  const rows = parseStatement(
    'data;valor;descricao;id\n10/11/2026;-16,20;"Tarifa; serviço";x1\n2026-11-11;200,00;Recarga;x2',
  );
  assert.equal(rows[0].amount, -1620);
  assert.equal(rows[0].memo, "Tarifa; serviço");
  assert.equal(rows[0].externalId, "x1");
  const ofx = parseStatement(
    "<OFX><CURDEF>BRL<BANKTRANLIST><STMTTRN><DTPOSTED>20261110120000[-3:BRT]\n<TRNAMT>-70.00\n<FITID>abc\n<MEMO>Consumo\n</STMTTRN></BANKTRANLIST></OFX>",
  );
  assert.equal(ofx[0].amount, -7000);
  assert.equal(ofx[0].date, day);
  assert.throws(
    () => parseStatement("data,valor,descricao\n2026-02-30,10,x"),
    /Data inválida/,
  );
  assert.throws(() => parseStatement("<OFX><CURDEF>USD</OFX>"), /BRL/);
});
test("reconciliation validates sign, amount, account and global duplicate matching", () => {
  const s = base();
  s.entries.push(entry("bill", "expense", 10000));
  s.settlements.push(
    settlement("payment", "payment", 10000, { entryId: "bill" }),
  );
  s.imports.push({
    id: "batch",
    accountId: "bank",
    name: "Test.csv",
    hash: "test-hash",
    raw: "original",
    importedAt: "2026-11-10T12:00:00Z",
  });
  s.statements.push({
    id: "row",
    accountId: "bank",
    externalId: "bank-id",
    fingerprint: "hash",
    date: day,
    amount: -10000,
    memo: "original",
    raw: "original",
    batchId: "batch",
    matches: [{ settlementId: "payment", amount: 10000 }],
  });
  validateState(s);
  s.statements.push({ ...s.statements[0], id: "row2", externalId: "bank-id2" });
  assert.throws(() => validateState(s), /já conciliada/);
});
test("rounding uses integer arithmetic even when intermediate multiplication exceeds safe float range", () => {
  assert.equal(mulDiv(99999999999, 99999999, 100000000), 99999998999);
  assert.equal(mulDiv(1, 1, 2), 1);
  assert.throws(() => mulDiv(1, 1, 0));
});

