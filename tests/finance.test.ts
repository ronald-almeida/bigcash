import { test } from "node:test";
import assert from "node:assert/strict";
import {
  movements,
  totals,
  validate,
  entryAmount,
  feeAmount,
  validDate,
  type Entry,
} from "../src/finance.ts";
const base: Entry = {
  id: "1",
  kind: "income",
  name: "Venda",
  amount: 100000,
  date: "2026-01-31",
  category: "Vendas",
  notes: "",
  recurring: false,
  endDate: "",
  status: "paid",
  feeType: "percent",
  feeValue: 250,
  feeClass: "service",
  incomeId: "",
  parts: [],
  review: false,
};
test("percentage fee rounds in cents and is counted once", () => {
  assert.equal(feeAmount(1999, "percent", 299), 60);
  const rows = movements([base], "2026-01-01", "2026-01-31");
  assert.equal(rows.length, 2);
  assert.deepEqual(totals(rows), { income: 100000, expense: 2500, net: 97500 });
});
test("fixed and separate linked fees preserve gross revenue", () => {
  const income = { ...base, feeType: "fixed" as const, feeValue: 500 };
  const fee = {
    ...base,
    id: "2",
    kind: "fee" as const,
    incomeId: "1",
    feeValue: 1000,
  };
  assert.equal(entryAmount(fee, [income]), 10000);
  assert.deepEqual(
    totals(movements([income, fee], "2026-01-01", "2026-01-31")),
    { income: 100000, expense: 10500, net: 89500 },
  );
});
test("recurring end-of-month clamps February and returns to March 31", () => {
  const e = {
    ...base,
    kind: "tool" as const,
    recurring: true,
    feeValue: 0,
    endDate: "2026-03-31",
  };
  assert.deepEqual(
    movements([e], "2026-01-01", "2026-12-31").map((x) => x.occurrence),
    ["2026-03-31", "2026-02-28", "2026-01-31"],
  );
});
test("pending rows do not affect available cash", () =>
  assert.deepEqual(
    totals(
      movements([{ ...base, status: "pending" }], "2026-01-01", "2026-01-31"),
    ),
    { income: 0, expense: 0, net: 0 },
  ));
test("BM aggregates all component costs", () =>
  assert.equal(
    entryAmount(
      {
        ...base,
        kind: "bm",
        parts: [
          { name: "Perfil", amount: 2000 },
          { name: "SMS", amount: 650 },
          { name: "Variável", amount: 450 },
        ],
      },
      [],
    ),
    3100,
  ));
test("date range is inclusive and future dates do not leak into cash", () => {
  assert.equal(movements([base], "2026-01-31", "2026-01-31").length, 2);
  assert.equal(movements([base], "2026-01-01", "2026-01-30").length, 0);
});
test("rejects impossible dates, negative cents, invalid percentage, and incomplete fees", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.throws(() => validate({ ...base, amount: -1 }));
  assert.throws(() => validate({ ...base, feeValue: 10001 }));
  assert.throws(() => validate({ ...base, kind: "fee", incomeId: "" }));
  assert.throws(() => validate({ ...base, recurring: true }));
  assert.throws(() => validate({ ...base, amount: 1.5 }));
});
test("recurrence before selected period still includes selected month", () => {
  assert.equal(
    movements(
      [{ ...base, kind: "fixed", recurring: true, feeValue: 0 }],
      "2026-09-01",
      "2026-09-30",
    )[0].occurrence,
    "2026-09-30",
  );
});

test("profit deducts pro-labore and payroll without counting pending payments or initial cash", () => {
  const income = { ...base, date: "2026-01-01", feeValue: 0 };
  const salary = {
    ...income,
    id: "salary",
    kind: "salary" as const,
    amount: 20000,
    recurring: true,
  };
  const payroll = {
    ...income,
    id: "payroll",
    kind: "payroll" as const,
    amount: 30000,
  };
  const pending = {
    ...salary,
    id: "pending",
    status: "pending" as const,
    amount: 90000,
  };
  assert.deepEqual(
    totals(
      movements([income, salary, payroll, pending], "2026-01-01", "2026-01-31"),
    ),
    { income: 100000, expense: 50000, net: 50000 },
  );
  assert.equal(
    totals(movements([salary], "2026-02-01", "2026-02-28")).net,
    -20000,
  );
});
