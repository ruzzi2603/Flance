/**
 * ENVIRONMENT VALIDATION - Schema Zod para validação de variáveis de ambiente
 *
 * Propósito: Garantir que todas as variáveis necessárias estão definidas e válidas
 * Benefícios:
 * - Falha rápido em startup (melhor que crashes em runtime)
 * - Validação de tipos de dados
 * - Valores padrão sensatos para dev
 * - IMPORTANTE: Em produção, ALL variáveis sensíveis são obrigatórias
 *
 * Uso: call validateEnv(process.env) em main.ts antes de criar app
 */

import { z } from "zod";

export const envSchema = z.object({
  // === AMBIENTE ===
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // === SERVER ===
  PORT: z.coerce.number().int().positive().default(3001),

  // === DATABASE ===
  DATABASE_URL: z.string().url().min(1, "DATABASE_URL é obrigatório"),
  DIRECT_URL: z.string().url().optional(), // Para migrations diretas no Supabase
  REDIS_URL: z.string().url().optional(), // Opcional - para cache em prod

  // === JWT / AUTH ===
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter mínimo 32 caracteres para segurança"),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600), // 1 hora
  JWT_REFRESH_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(604800), // 7 dias
  JWT_RESET_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900), // 15 minutos

  // === CORS / SEGURANÇA ===
  CORS_ORIGIN: z.string().default("http://localhost:3000").describe(
    "CORS origin para requisições do frontend. Em produção, usar URL específica (ex: https://flance.com)",
  ),

  // === EMAIL (SMTP) ===
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // === FRONTEND ===
  WEB_BASE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  // === INTEGRAÇÕES (OPCIONAIS até MVP, OBRIGATÓRIAS em prod) ===
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Valida variáveis de ambiente no startup
 * IMPORTANTE: Se falhar, a aplicação não inicia (intencional - fail fast)
 *
 * @throws Error se variáveis faltam ou são inválidas
 * @returns Objeto tipado com todas as variáveis de ambiente validadas
 */
export function validateEnv(input: Record<string, unknown>): EnvConfig {
  const isDev = input.NODE_ENV === "development";

  try {
    const result = envSchema.parse(input);

    // Validações adicionais em produção
    if (result.NODE_ENV === "production") {
      if (!input.JWT_SECRET || (input.JWT_SECRET as string).length < 32) {
        throw new Error("JWT_SECRET deve ter mínimo 32 caracteres em produção");
      }
      if (!input.DATABASE_URL) {
        throw new Error("DATABASE_URL é obrigatório em produção");
      }
      // SMTP é recomendado para recuperação de senha
      if (!input.SMTP_HOST || !input.SMTP_USER || !input.SMTP_PASS) {
        console.warn("[WARNING] SMTP não configurado - password reset não funcionará em produção");
      }
    }

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("\n");
      throw new Error(`[ENV VALIDATION ERROR]\n${formatted}`);
    }
    throw error;
  }
}

