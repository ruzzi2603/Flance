export interface CpfValidationResult {
  isValid: boolean;
  cleanCpf: string;
  formattedCpf: string;
  errorMessage?: string;
}

/**
 * Validação estrutural/matemática de CPF (Algoritmo oficial Módulo 11)
 *
 * IMPORTANTE (Regra 8):
 * A validação matemática do CPF NÃO significa que o CPF pertence à pessoa.
 * Apenas verifica formato, tamanho, sequências inválidas e dígitos verificadores.
 */
export function validateCpf(rawCpf: unknown): CpfValidationResult {
  if (!rawCpf || typeof rawCpf !== "string") {
    return {
      isValid: false,
      cleanCpf: "",
      formattedCpf: "",
      errorMessage: "CPF é obrigatório.",
    };
  }

  // Remove caracteres não numéricos
  const clean = rawCpf.replace(/\D/g, "");

  if (clean.length !== 11) {
    return {
      isValid: false,
      cleanCpf: clean,
      formattedCpf: "",
      errorMessage: "CPF deve conter exatamente 11 dígitos numéricos.",
    };
  }

  // Rejeita sequências com todos os dígitos iguais (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(clean)) {
    return {
      isValid: false,
      cleanCpf: clean,
      formattedCpf: "",
      errorMessage: "CPF inválido (dígitos repetidos).",
    };
  }

  // Cálculo do 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rest = 11 - (sum % 11);
  const digit1 = rest === 10 || rest === 11 ? 0 : rest;

  if (digit1 !== parseInt(clean.charAt(9), 10)) {
    return {
      isValid: false,
      cleanCpf: clean,
      formattedCpf: "",
      errorMessage: "CPF inválido (dígitos verificadores incorretos).",
    };
  }

  // Cálculo do 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rest = 11 - (sum % 11);
  const digit2 = rest === 10 || rest === 11 ? 0 : rest;

  if (digit2 !== parseInt(clean.charAt(10), 10)) {
    return {
      isValid: false,
      cleanCpf: clean,
      formattedCpf: "",
      errorMessage: "CPF inválido (dígitos verificadores incorretos).",
    };
  }

  const formatted = clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

  return {
    isValid: true,
    cleanCpf: clean,
    formattedCpf: formatted,
  };
}

/**
 * Mascara o CPF para segurança em logs e respostas (Regra 8 e 30)
 * Exemplo: "123.456.789-01" -> "***.456.789-**"
 */
export function maskCpf(rawCpf?: string | null): string {
  if (!rawCpf) return "";
  const clean = rawCpf.replace(/\D/g, "");
  if (clean.length !== 11) return "***";
  return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
}
