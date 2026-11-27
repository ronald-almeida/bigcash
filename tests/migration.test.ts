import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { initialState } from "../src/operations.ts";
test("additive migrations preserve legacy financial data, settings, sessions and document tables; audit is atomic", () => {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((x) => x.endsWith(".sql"))
    .sort();
  for (const name of files.filter((x) => x < "0007"))
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  db.prepare("INSERT INTO entries(id,data) VALUES(?,?)").run(
    "historical",
    JSON.stringify({ name: "Histórico preservado", amount: 12345 }),
  );
  db.exec(
    "INSERT INTO sessions(token,expires) VALUES('test-session',9999999999999); UPDATE settings SET opening_balance=56789; CREATE TABLE historical_documents(id TEXT, content TEXT); INSERT INTO historical_documents VALUES('document','preservado');",
  );
  for (const name of files.filter((x) => x >= "0007"))
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  assert.equal(
    db.prepare("SELECT opening_balance FROM settings").get()!.opening_balance,
    56789,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()!.n, 1);
  assert.equal(
    db.prepare("SELECT content FROM historical_documents").get()!.content,
    "preservado",
  );
  assert.equal(
    JSON.parse(String(db.prepare("SELECT data FROM entries").get()!.data))
      .amount,
    12345,
  );
  db.prepare(
    "INSERT INTO finance_workspace VALUES(1,0,?,'initial','','Inicial',CURRENT_TIMESTAMP)",
  ).run(JSON.stringify(initialState()));
  db.exec(
    "UPDATE finance_workspace SET version=1,request_id='unique-request',reason='Teste' WHERE version=0;",
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM finance_audit").get()!.n,
    1,
  );
  assert.throws(() =>
    db.exec(
      "UPDATE finance_workspace SET version=2,request_id='unique-request' WHERE version=1;",
    ),
  );
  assert.equal(
    db.prepare("SELECT version FROM finance_workspace").get()!.version,
    1,
  );
  assert.equal(
    Object.values(db.prepare("PRAGMA integrity_check").get()!)[0],
    "ok",
  );
  db.close();
});

