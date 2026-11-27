// Remote migrations require a fresh full SQL export and successful local restore first.
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
const args = process.argv.slice(2),
  remote = args.includes("--remote");
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
function cli(values, capture = false) {
  const p = spawnSync(process.execPath, [wrangler, ...values], {
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (p.status !== 0)
    throw Error(`Wrangler falhou (${p.status}). ${capture ? p.stderr : ""}`);
  return p.stdout;
}
if (!remote) {
  cli(["d1", "migrations", "apply", "bigcash-db", "--local"]);
  process.exit(0);
}
const i = args.indexOf("--backup");
if (i < 0 || !args[i + 1])
  throw Error(
    "Use --remote --backup CAMINHO_FORA_DO_REPOSITORIO.sql. O backup e a restauração serão verificados antes da migração.",
  );
const backup = resolve(args[i + 1]),
  repo = process.cwd();
const relativePath = relative(repo, backup);
if (
  relativePath !== ".." &&
  !relativePath.startsWith(".." + sep) &&
  !isAbsolute(relativePath)
)
  throw Error("Guarde o backup fora do repositório público.");
if (existsSync(backup))
  throw Error(
    "Escolha um arquivo novo; backups existentes não serão sobrescritos.",
  );
mkdirSync(dirname(backup), { recursive: true });
const recovery = cli(["d1", "time-travel", "info", "bigcash-db"], true);
writeFileSync(backup + ".recovery.txt", recovery, { flag: "wx" });
cli(["d1", "export", "bigcash-db", "--remote", "--output", backup]);
const sql = readFileSync(backup, "utf8");
if (sql.length < 100 || !sql.includes("CREATE TABLE"))
  throw Error("Backup incompleto. Migração cancelada.");
const db = new DatabaseSync(":memory:");
db.exec(sql);
const integrity = db.prepare("PRAGMA integrity_check").get();
if (Object.values(integrity)[0] !== "ok")
  throw Error("Backup não passou na verificação de integridade.");
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  )
  .all();
for (const required of ["entries", "settings", "sessions"])
  if (!tables.some((t) => t.name === required))
    throw Error("Backup sem tabela esperada: " + required);
const counts = Object.fromEntries(
  tables.map((t) => [
    t.name,
    db
      .prepare(
        'SELECT COUNT(*) AS n FROM "' + t.name.replaceAll('"', '""') + '"',
      )
      .get().n,
  ]),
);
writeFileSync(
  backup + ".verified.json",
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      sha256: createHash("sha256").update(sql).digest("hex"),
      bytes: Buffer.byteLength(sql),
      counts,
      restore: "SQLite em memória: integrity_check ok",
    },
    null,
    2,
  ),
  { flag: "wx" },
);
db.close();
console.log(
  "Backup completo restaurado localmente e verificado. Referência de recuperação gravada. Aplicando migrações aditivas.",
);
cli(["d1", "migrations", "apply", "bigcash-db", "--remote"]);

