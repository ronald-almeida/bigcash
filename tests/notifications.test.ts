import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAlerts } from "../src/notifications.ts";
import type { Entry } from "../src/finance.ts";
const e: Entry = {
  id: "1",
  kind: "daily",
  name: "Conta",
  amount: 10000,
  date: "2026-09-26",
  category: "Geral",
  notes: "",
  recurring: false,
  endDate: "",
  status: "pending",
  feeType: "fixed",
  feeValue: 0,
  feeClass: "service",
  incomeId: "",
  parts: [],
  review: false,
};
test("alert stages: overdue, today, next 3 days; no paid alerts", () => {
  const a = buildAlerts(
    [
      { ...e, id: "old", date: "2026-09-25" },
      e,
      { ...e, id: "soon", date: "2026-09-29" },
      { ...e, id: "later", date: "2026-09-30" },
      { ...e, id: "paid", status: "paid" },
    ],
    "2026-09-26",
  );
  assert.deepEqual(
    a.map((x) => x.kind),
    ["overdue", "due", "upcoming"],
  );
});
test("income fee does not duplicate reminders", () =>
  assert.equal(
    buildAlerts([{ ...e, kind: "income", feeValue: 500 }], "2026-09-26").length,
    1,
  ));
test("review alerts remain available without pending expense", () =>
  assert.equal(
    buildAlerts([{ ...e, status: "paid", review: true }], "2026-09-26")[0].kind,
    "review",
  ));
test("recurring pending alerts clamp month-end and have stable distinct IDs", () => {
  const a = buildAlerts(
    [
      {
        ...e,
        kind: "fixed",
        recurring: true,
        date: "2026-01-31",
        endDate: "2026-03-31",
      },
    ],
    "2026-03-31",
  );
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((x) => x.id)).size, 3);
  assert.ok(a.some((x) => x.date === "2026-02-28"));
});
