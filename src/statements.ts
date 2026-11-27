import { validDate } from "./finance.ts";
export interface ParsedRow {
  externalId: string;
  date: string;
  amount: number;
  memo: string;
  raw: string;
}
function amount(value: string) {
  let normalized = value.trim().replace(/R\$|\s/g, "");
  if (normalized.includes(","))
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized))
    throw Error("Valor inválido no extrato: " + value);
  const n = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 100000000000 || n === 0)
    throw Error("Valor do extrato fora do intervalo.");
  return n;
}
function date(value: string) {
  let d = value.trim();
  if (/^\d{8}/.test(d))
    d = d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8);
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(d))
    d = d.split("/").reverse().join("-");
  if (!validDate(d)) throw Error("Data inválida no extrato: " + value);
  return d;
}
function csvRows(raw: string): string[][] {
  const first = raw.split(/\r?\n/)[0];
  const separator = first.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (quoted && raw[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (ch === separator || ch === "\n")) {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      if (ch === "\n") {
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
      }
    } else cell += ch;
  }
  if (quoted) throw Error("CSV contém aspas sem fechamento.");
  row.push(cell.replace(/\r$/, ""));
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export function parseStatement(raw: string): ParsedRow[] {
  if (!raw.trim() || raw.length > 2000000)
    throw Error("Envie OFX/CSV com até 2 MB.");
  raw = raw.replace(/^\uFEFF/, "");
  if (/<OFX[>\s]/i.test(raw)) {
    if (/<CURDEF>\s*(?!BRL\b)[A-Z]{3}/i.test(raw))
      throw Error("Somente extratos em BRL são suportados.");
    const blocks = [
      ...raw.matchAll(
        /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi,
      ),
    ];
    if (!blocks.length) throw Error("OFX sem movimentações reconhecíveis.");
    return blocks.map(([original, block]) => {
      const tag = (name: string) =>
        block
          .match(new RegExp("<" + name + ">([^<\\r\\n]*)", "i"))?.[1]
          ?.trim() ?? "";
      return {
        externalId: tag("FITID"),
        date: date(tag("DTPOSTED")),
        amount: amount(tag("TRNAMT")),
        memo: tag("MEMO") || tag("NAME"),
        raw: original,
      };
    });
  }
  const [headers, ...rows] = csvRows(raw);
  if (!headers) throw Error("CSV vazio.");
  const normalized = headers.map((x) =>
    x
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
  const index = (names: string[]) =>
    normalized.findIndex((x) => names.includes(x));
  const d = index(["data", "date"]),
    v = index(["valor", "amount"]),
    m = index(["descricao", "historico", "memo", "description"]),
    i = index(["id", "fitid", "identificador"]);
  if (d < 0 || v < 0 || m < 0)
    throw Error(
      "CSV exige colunas data, valor, descricao; id é opcional. Use valores negativos para saídas.",
    );
  return rows.map((row) => {
    if (row.length !== headers.length)
      throw Error("Quantidade de colunas inconsistente no CSV.");
    return {
      externalId: i >= 0 ? row[i].trim() : "",
      date: date(row[d]),
      amount: amount(row[v]),
      memo: row[m].trim(),
      raw: JSON.stringify(row),
    };
  });
}

