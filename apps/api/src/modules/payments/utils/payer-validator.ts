import { BadRequestException } from "@nestjs/common";
import { validateCpf } from "./cpf-validator";

export interface ValidatedPayerData {
  name: string;
  email: string;
  cpf: string;
}

/**
 * Validação de Nome (Regra 6):
 * - Obrigatório
 * - Mínimo 3 caracteres, máximo 100
 * - Remoção de espaços desnecessários
 * - Pelo menos nome e sobrenome
 * - Não aceitar apenas números ou caracteres especiais
 */
export function validatePayerName(rawName: unknown): string {
  if (!rawName || typeof rawName !== "string") {
    throw new BadRequestException("Nome completo é obrigatório.");
  }

  // Normaliza espaços múltiplos
  const normalized = rawName.trim().replace(/\s+/g, " ");

  if (normalized.length < 3) {
    throw new BadRequestException("O nome deve ter no mínimo 3 caracteres.");
  }

  if (normalized.length > 100) {
    throw new BadRequestException("O nome não pode exceder 100 caracteres.");
  }

  // Não aceita apenas números ou símbolos sem letras
  if (!/[a-zA-ZÀ-ÿ]/.test(normalized)) {
    throw new BadRequestException("Nome inválido (não pode conter apenas números).");
  }

  // Pelo menos nome e sobrenome (mínimo 2 palavras com pelo menos 2 caracteres cada)
  const parts = normalized.split(" ");
  if (parts.length < 2 || parts[0].length < 2 || parts[1].length < 2) {
    throw new BadRequestException("Informe o nome completo com pelo menos nome e sobrenome.");
  }

  return normalized;
}

/**
 * Validação de E-mail (Regra 7):
 * - Obrigatório
 * - Formato válido
 * - Normalização para lowercase
 * - Remoção de espaços
 * - Máximo 255 caracteres
 */
export function validatePayerEmail(rawEmail: unknown): string {
  if (!rawEmail || typeof rawEmail !== "string") {
    throw new BadRequestException("E-mail é obrigatório.");
  }

  const normalized = rawEmail.trim().toLowerCase();

  if (normalized.length > 255) {
    throw new BadRequestException("O e-mail não pode exceder 255 caracteres.");
  }

  // Expressão regular robusta para email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalized)) {
    throw new BadRequestException("E-mail informado é inválido.");
  }

  return normalized;
}

/**
 * Valida o conjunto de dados do pagador
 */
export function validatePayerData(input: {
  name: unknown;
  email: unknown;
  cpf: unknown;
}): ValidatedPayerData {
  const name = validatePayerName(input.name);
  const email = validatePayerEmail(input.email);
  const cpfResult = validateCpf(input.cpf);

  if (!cpfResult.isValid) {
    throw new BadRequestException(cpfResult.errorMessage || "CPF inválido.");
  }

  return {
    name,
    email,
    cpf: cpfResult.cleanCpf,
  };
}
