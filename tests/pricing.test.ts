import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePricing, defaultPricing } from "../src/pricing.ts";
test("1001 leads need five BM250 chips but one BM2000 chip", () => {
  const p = { ...defaultPricing, messages: 1001, chipCost: 1000 };
  assert.equal(calculatePricing(p).chips, 5);
  assert.equal(calculatePricing({ ...p, messagesPerChip: 2000 }).chips, 1);
});
test("exact BM boundary and multiple chips per BM", () => {
  assert.equal(calculatePricing({ ...defaultPricing, messages: 1000 }).bms, 4);
  assert.equal(
    calculatePricing({ ...defaultPricing, messages: 1001, chipsPerBm: 2 })
      .chips,
    10,
  );
});
test("delivery loss reduces BM capacity, including spare capacity", () => {
  const r = calculatePricing({
    ...defaultPricing,
    messages: 1000,
    deliveryRate: 80,
  });
  assert.equal(r.usablePerChip, 200);
  assert.equal(r.bms, 5);
  assert.equal(r.spare, 0);
});
test("margin is on revenue with sales taxes, fixed lot cost and BM costs", () => {
  const r = calculatePricing({
    ...defaultPricing,
    messages: 1000,
    chipCost: 1000,
    bmCost: 500,
    campaignCost: 1000,
    salesTax: 10,
    margin: 20,
  });
  assert.equal(r.cost, 7000);
  assert.equal(r.price, 10000);
  assert.equal(r.tax, 1000);
  assert.equal(r.profit, 2000);
});
test("integrated farm, tools, fixed costs and pro-labore are included in price", () => {
  const r = calculatePricing({ ...defaultPricing, messages: 1000, margin: 0 }, 20000);
  assert.equal(r.cost, 20000);
  assert.equal(r.unitPrice, 20);
  assert.equal(r.price, 20000);
});
test("rejects invalid pricing rather than NaN or infinite prices", () => {
  for (const p of [
    { margin: 100 },
    { margin: 80, salesTax: 20 },
    { messages: 0 },
    { chipCost: -1 },
    { chipsPerBm: 0 },
    { deliveryRate: 0 },
    { messages: 1.5 },
    { chipCost: NaN },
  ])
    assert.throws(() => calculatePricing({ ...defaultPricing, ...p }));
});
test("chip budget respects chips per BM and does not invent capacity", () => {
  const r = calculatePricing({
    ...defaultPricing,
    mode: "chips",
    chips: 5,
    chipsPerBm: 2,
  });
  assert.equal(r.bms, 2);
  assert.equal(r.chips, 4);
  assert.equal(r.messages, 500);
});
