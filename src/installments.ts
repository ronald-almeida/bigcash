import { validate, validDate, type Entry } from "./finance.ts";
export function installmentEntries(
  input: unknown,
  count: number,
  requestId: string,
): Entry[] {
  const e = validate(input);
  if (
    e.id ||
    e.kind === "income" ||
    e.kind === "bm" ||
    e.kind === "fee" ||
    e.recurring ||
    !Number.isInteger(count) ||
    count < 2 ||
    count > 60 ||
    e.amount < count ||
    !/^[a-f0-9-]{36}$/.test(requestId)
  )
    throw Error(
      "Informe de 2 a 60 parcelas, valor total válido e uma despesa sem recorrência.",
    );
  const start = new Date(e.date + "T12:00:00Z");
  const base = Math.floor(e.amount / count);
  const remainder = e.amount % count;
  return Array.from({ length: count }, (_, i) => {
    const month = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    );
    const day = Math.min(
      start.getUTCDate(),
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
      ).getUTCDate(),
    );
    month.setUTCDate(day);
    const date = month.toISOString().slice(0, 10);
    if (!validDate(date))
      throw Error("O último vencimento deve ocorrer até 2100.");
    return {
      ...e,
      id: `${requestId}-${i + 1}`,
      name: `${e.name.slice(0, 100)} · ${i + 1}/${count}`,
      amount: base + (i < remainder ? 1 : 0),
      date,
      recurring: false,
      endDate: "",
      status: "pending",
    };
  });
}
