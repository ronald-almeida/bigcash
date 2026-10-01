import { test } from "node:test";
import assert from "node:assert/strict";
import { installmentEntries } from "../src/installments.ts";
import { totals, movements, type Entry } from "../src/finance.ts";
const base: Entry = {
  id: "",
  kind: "fixed",
  name: "Compra",
  amount: 10000,
  date: "2026-01-31",
  category: "Geral",
  notes: "",
  recurring: false,
  endDate: "",
  status: "pending",
  feeType: "fixed",
  feeValue: 0,
  feeClass: "tax",
  incomeId: "",
  parts: [],
  review: false,
};
const id = "11111111-1111-4111-8111-111111111111";
test("installments preserve total cents, month-end dates and individual payment status", () => {
  const parts = installmentEntries(base, 3, id);
  assert.deepEqual(
    parts.map((e) => e.amount),
    [3334, 3333, 3333],
  );
  assert.deepEqual(
    parts.map((e) => e.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  parts[0].status = "paid";
  assert.equal(
    totals(movements(parts, "2026-01-01", "2026-12-31")).expense,
    3334,
  );
  assert.deepEqual(
    installmentEntries(base, 3, id).map((e) => e.id),
    parts.map((e) => e.id),
  );
});
test("installments reject invalid quantity, recurring series, zero-cent parts and overflow dates", () => {
  for (const count of [0, 1, 2.5, 61, NaN])
    assert.throws(() => installmentEntries(base, count, id));
  assert.throws(() => installmentEntries({ ...base, recurring: true }, 3, id));
  assert.throws(() => installmentEntries({ ...base, amount: 2 }, 3, id));
  assert.throws(() =>
    installmentEntries({ ...base, date: "2100-12-31" }, 3, id),
  );
});
