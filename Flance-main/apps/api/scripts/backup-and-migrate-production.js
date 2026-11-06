#!/usr/bin/env node
/**
 * Creates and verifies a public-schema backup before applying Prisma migrations.
 * Run from the repository root with --project-ref=<confirmed-production-ref>.
 * Requires pg_dump and pg_restore from PostgreSQL client tools.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { URL } = require("node:url");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(root, ".env"), override: false });

function option(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

function projectRefFromUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const direct = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (direct) return direct[1];
    const projectUrl = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    if (projectUrl) return projectUrl[1];
    const username = decodeURIComponent(url.username);
    const pooled = username.match(/^postgres\.([a-z0-9]+)$/i);
    return pooled?.[1] ?? "";
  } catch {
    return "";
  }
}

function parseConnection(value) {
  const url = new URL(value);
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error("DIRECT_URL não é uma URL PostgreSQL válida.");
  return {
    host: url.hostname,
    port: url.port || "5432",
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
  };
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    env: options.env ?? process.env,
    windowsHide: true,
  });
  if (result.error) throw new Error(`${binary} indisponível: ${result.error.message}`);
  if (result.status !== 0) {
    const message = options.inherit ? "" : (result.stderr || result.stdout || "").trim();
    throw new Error(`${binary} terminou com código ${result.status}${message ? `: ${message}` : "."}`);
  }
  return result;
}

async function main() {
  const expectedRef = option("project-ref");
  if (!/^[a-z0-9]{20}$/i.test(expectedRef)) {
    throw new Error("Informe --project-ref=<ref-de-20-caracteres-do-projeto-de-produção>.");
  }
  if (!process.env.DIRECT_URL || !process.env.DATABASE_URL) {
    throw new Error("Configure DATABASE_URL e DIRECT_URL no .env antes de continuar.");
  }

  const directRef = projectRefFromUrl(process.env.DIRECT_URL);
  const pooledRef = projectRefFromUrl(process.env.DATABASE_URL);
  if (directRef !== expectedRef || pooledRef !== expectedRef) {
    throw new Error("As conexões PostgreSQL não correspondem ao project ref confirmado; nenhum backup ou migration foi iniciado.");
  }
  if (process.env.SUPABASE_URL) {
    const apiRef = projectRefFromUrl(process.env.SUPABASE_URL);
    if (apiRef && apiRef !== expectedRef) {
      throw new Error("SUPABASE_URL aponta para outro projeto; nenhum backup ou migration foi iniciado.");
    }
  }

  const connection = parseConnection(process.env.DIRECT_URL);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDirectory = process.env.FLANCE_BACKUP_DIR || path.join(os.homedir(), "Flance-backups", expectedRef);
  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupFile = path.join(backupDirectory, `flance-public-${timestamp}.dump`);

  console.log(`Projeto confirmado: ${expectedRef}`);
  console.log(`Destino do backup: ${backupFile}`);
  console.log("Criando backup do schema public antes das migrations...");
  run("pg_dump", [
    "--host", connection.host,
    "--port", connection.port,
    "--username", connection.username,
    "--dbname", connection.database,
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--schema=public",
    `--file=${backupFile}`,
  ], { inherit: true, env: { ...process.env, PGPASSWORD: connection.password, PGSSLMODE: "require" } });

  if (!fs.existsSync(backupFile) || fs.statSync(backupFile).size < 1024) {
    throw new Error("O backup não foi criado corretamente; migrations não foram executadas.");
  }
  run("pg_restore", ["--list", backupFile]);
  console.log(`Backup criado e validado (${fs.statSync(backupFile).size} bytes).`);

  console.log("Aplicando migrations Prisma no banco confirmado...");
  if (process.platform === "win32") {
    run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm run db:migrate:deploy --workspace @flance/api"], { inherit: true });
  } else {
    run("npm", ["run", "db:migrate:deploy", "--workspace", "@flance/api"], { inherit: true });
  }
  console.log("Migrations aplicadas. Guarde o caminho do backup junto ao registro do deploy.");
}

main().catch((error) => {
  console.error(`Deploy do banco interrompido: ${error.message}`);
  process.exitCode = 1;
});
