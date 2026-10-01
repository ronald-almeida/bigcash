import { test } from "node:test";
import assert from "node:assert/strict";
import { overdueDebts } from "../src/debts.ts";
import type { Entry } from "../src/finance.ts";
const base: Entry = {
  id: "1",
  kind: "daily",
  name: "Conta",
  amount: 1000,
  date: "2026-09-01",
  category: "",
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
test("debts include only unpaid expenses before today and exclude receivable fees", () => {
  const rows = overdueDebts(
    [
      base,
      { ...base, id: "paid", status: "paid" },
      { ...base, id: "today", date: "2026-09-29" },
      { ...base, id: "future", date: "2026-10-01" },
      { ...base, id: "income", kind: "income", feeValue: 100 },
    ],
    "2026-09-29",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].daysLate, 28);
  assert.equal(rows[0].total, 1000);
});
test("recurring debts remain separate for each overdue month", () => {
  const rows = overdueDebts(
    [{ ...base, kind: "fixed", recurring: true, date: "2026-07-31" }],
    "2026-09-29",
  );
  assert.deepEqual(
    rows.map((r) => r.occurrence),
    ["2026-07-31", "2026-08-31"],
  );
});
