#!/usr/bin/env node
/**
 * Checagem de pré-produção do módulo de pagamentos.
 *   npm run payments:check          (usa o .env carregado no ambiente)
 *
 * Valida variáveis, o par chave/ambiente do Asaas e consulta a API do Asaas.
 * NÃO cria cobranças nem assinaturas. Sai com código 1 se algo bloqueante falhar.
 */
const fs = require("fs");
const path = require("path");

// Carrega .env simples (sem depender de dotenv) sem sobrescrever o ambiente
for (const candidate of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")]) {
  if (!fs.existsSync(candidate)) continue;
  for (const line of fs.readFileSync(candidate, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  break;
}

const env = process.env;
const results = [];
const ok = (m) => results.push(["ok", m]);
const warn = (m) => results.push(["warn", m]);
const fail = (m) => results.push(["fail", m]);

const isProd = env.NODE_ENV === "production";
const key = (env.ASAAS_API_KEY || "").trim();
const baseUrl = (env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3").trim();
const isSandboxUrl = baseUrl.includes("api-sandbox.asaas.com");

// --- Chave / ambiente
if (!key) fail("ASAAS_API_KEY ausente.");
else {
  if (key.includes("$aact_") === false) fail("ASAAS_API_KEY não parece uma chave do Asaas ($aact_...). Use aspas simples no .env por causa do '$'.");
  const prodKey = key.startsWith("$aact_prod_");
  const sandboxKey = key.startsWith("$aact_hmlg_");
  if (isSandboxUrl && prodKey) fail("Chave de PRODUÇÃO com URL do SANDBOX. A API vai responder 500. Troque a URL para https://api.asaas.com/v3 ou use a chave de sandbox.");
  else if (!isSandboxUrl && sandboxKey) fail("Chave de SANDBOX com URL de PRODUÇÃO.");
  else ok(`Chave e URL combinam (${isSandboxUrl ? "sandbox" : "produção"}).`);
}
if (isProd && isSandboxUrl) fail("NODE_ENV=production apontando para o SANDBOX do Asaas: nenhuma cobrança será real.");
if (!isProd) warn("NODE_ENV não é 'production' (ok para testes; em produção várias travas ficam ativas).");

// --- Segredos
const hex32 = (v) => typeof v === "string" && v.trim().length >= 32;
hex32(env.ASAAS_WEBHOOK_TOKEN) ? ok("ASAAS_WEBHOOK_TOKEN definido.") : fail("ASAAS_WEBHOOK_TOKEN ausente/curto (gere com: openssl rand -hex 32).");
hex32(env.ASAAS_CPF_ENCRYPTION_KEY) ? ok("ASAAS_CPF_ENCRYPTION_KEY definido.") : fail("ASAAS_CPF_ENCRYPTION_KEY ausente/curto (gere com: openssl rand -hex 32).");
hex32(env.JWT_SECRET) ? ok("JWT_SECRET com tamanho adequado.") : fail("JWT_SECRET ausente ou com menos de 32 caracteres.");
if (["change-me", "secret", "troque-por-um-segredo-com-no-minimo-32-caracteres"].includes((env.JWT_SECRET || "").trim())) fail("JWT_SECRET é um valor de exemplo.");

// --- Contrato
for (const name of ["COMPANY_LEGAL_NAME", "COMPANY_CNPJ", "COMPANY_ADDRESS"]) {
  const v = (env[name] || "").trim();
  !v || v.includes("PREENCHER") ? (isProd ? fail : warn)(`${name} não preenchida (consta no contrato de assinatura).`) : ok(`${name} preenchida.`);
}
if (!(env.COMPANY_SUPPORT_EMAIL || env.SMTP_FROM)) warn("COMPANY_SUPPORT_EMAIL/SMTP_FROM ausentes: o contrato mostrará um e-mail de suporte genérico.");

// --- URLs
for (const name of ["WEB_BASE_URL", "CORS_ORIGIN", "NEXT_PUBLIC_API_URL"]) {
  const v = (env[name] || "").trim();
  if (!v) fail(`${name} ausente.`);
  else if (isProd && (/localhost|127\.0\.0\.1|ngrok/i.test(v) || !v.startsWith("https://"))) fail(`${name}="${v}" não serve em produção (precisa ser HTTPS e o domínio real). Os links dos e-mails de cobrança usam WEB_BASE_URL.`);
  else ok(`${name} definido.`);
}

// --- Banco
const dbUrl = env.DATABASE_URL || "";
if (!dbUrl) fail("DATABASE_URL ausente.");
else if (/:6543\b|pgbouncer=true/.test(dbUrl) && !env.DIRECT_URL) fail("DATABASE_URL usa PgBouncer (6543) e DIRECT_URL não está definida: 'prisma migrate deploy' vai falhar. Defina DIRECT_URL com a conexão direta (porta 5432).");
else ok("Configuração de banco consistente para migrations.");

// --- E-mail
for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) env[name] ? ok(`${name} definido.`) : fail(`${name} ausente: o código de ativação e os avisos de cobrança dependem de e-mail.`);

// --- Proxy
isProd && !env.TRUST_PROXY_HOPS ? warn("TRUST_PROXY_HOPS não definido. Atrás de proxy/load balancer defina 1, senão o IP do aceite do contrato será o do proxy.") : ok("TRUST_PROXY_HOPS configurado ou não necessário.");

async function checkAsaas() {
  if (!key || results.some(([s, m]) => s === "fail" && /Chave de/.test(m))) return;
  try {
    const res = await fetch(`${baseUrl}/customers?limit=1`, {
      headers: { access_token: key, "User-Agent": "Flance-App/1.0", "Content-Type": "application/json" },
    });
    // Consume the response before exiting so Node closes the HTTP connection cleanly on Windows.
    await res.text();
    if (res.status === 401) fail("Asaas respondeu 401: chave inválida ou de outro ambiente.");
    else if (!res.ok) fail(`Asaas respondeu HTTP ${res.status} ao listar clientes.`);
    else ok(`API do Asaas acessível e chave aceita (${isSandboxUrl ? "sandbox" : "produção"}).`);
  } catch (error) {
    fail(`Não foi possível alcançar o Asaas (${baseUrl}): ${error.message}`);
  }
}

(async () => {
  await checkAsaas();
  const icon = { ok: "✅", warn: "⚠️ ", fail: "❌" };
  console.log("\nChecagem de pagamentos\n");
  for (const [status, message] of results) console.log(`${icon[status]} ${message}`);
  const fails = results.filter(([s]) => s === "fail").length;
  const warns = results.filter(([s]) => s === "warn").length;
  console.log(`\n${fails} bloqueio(s), ${warns} aviso(s).`);
  if (env.API_PUBLIC_URL || env.WEB_BASE_URL) {
    console.log("\nWebhook a cadastrar no painel do Asaas:");
    console.log(`  URL:    ${(env.API_PUBLIC_URL || "https://<sua-api>").replace(/\/$/, "")}/v1/payments/webhook`);
    console.log("  Token:  o valor de ASAAS_WEBHOOK_TOKEN");
    console.log("  Eventos: PAYMENT_CREATED, PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED");
  }
  process.exitCode = fails ? 1 : 0;
})();
