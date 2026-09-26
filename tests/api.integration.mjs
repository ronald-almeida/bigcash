// Run against local Wrangler only: node tests/api.integration.mjs
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:8787";
let cookie = "";
let count = 0;
async function request(
  path,
  method = "GET",
  body,
  expected = 200,
  withOrigin = true,
) {
  const r = await fetch(origin + "/api/" + path, {
    method,
    headers: {
      ...(withOrigin ? { Origin: origin } : {}),
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${await r.clone().text()}`,
  );
  count++;
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  return r.json();
}
await request("data", "GET", undefined, 401);
await request("login", "POST", { password: "wrong" }, 401);
await request("login", "POST", { password: "bigcash-local-test-only" });
await request("settings", "PUT", { openingBalance: 0 }, 403, false);
const base = {
  id: "",
  kind: "income",
  name: "API TEST",
  amount: 100000,
  date: "2026-09-15",
  category: "Test",
  notes: "",
  recurring: false,
  endDate: "",
  status: "paid",
  feeType: "percent",
  feeValue: 500,
  feeClass: "service",
  incomeId: "",
  parts: [],
  review: false,
};
const income = (await request("entries", "POST", base)).entry;
const fee = (
  await request("entries", "POST", {
    ...base,
    kind: "fee",
    name: "API TEST TAX",
    incomeId: income.id,
    feeValue: 200,
  })
).entry;
await request("entries/" + income.id, "DELETE", undefined, 409);
await request(
  "entries",
  "POST",
  { ...base, kind: "fee", incomeId: "missing" },
  400,
);
await request("entries", "POST", { ...base, amount: -500 }, 400);
await request("entries", "POST", { ...income, amount: 250000 });
let data = await request("data");
assert.equal(data.entries.find((x) => x.id === income.id).amount, 250000);
await request("entries/" + fee.id, "DELETE");
await request("entries/" + income.id, "DELETE");
await request("logout", "POST");
await request("data", "GET", undefined, 401);
console.log(
  `${count} API checks passed: authentication, CSRF, persistence, validation, linked fees, edit, delete, logout.`,
);
