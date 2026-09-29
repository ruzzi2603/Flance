import { describe, expect, it } from "vitest";
import { validateCpf } from "./cpf-validator";
import { validatePayerData, validatePayerEmail, validatePayerName } from "./payer-validator";

describe("Payer and CPF Validation", () => {
  describe("validateCpf", () => {
    it("deve aceitar CPFs matematicamente válidos", () => {
      // CPFs válidos conhecidos (algorítmicos)
      expect(validateCpf("52998224725").isValid).toBe(true);
      expect(validateCpf("529.982.247-25").isValid).toBe(true);
      expect(validateCpf("11144477735").isValid).toBe(true);
    });

    it("deve rejeitar sequências de dígitos repetidos", () => {
      expect(validateCpf("11111111111").isValid).toBe(false);
      expect(validateCpf("00000000000").isValid).toBe(false);
      expect(validateCpf("99999999999").isValid).toBe(false);
    });

    it("deve rejeitar CPFs com dígitos verificadores incorretos", () => {
      expect(validateCpf("52998224726").isValid).toBe(false);
      expect(validateCpf("12345678900").isValid).toBe(false);
    });

    it("deve rejeitar CPFs com tamanho incorreto ou vazios", () => {
      expect(validateCpf("").isValid).toBe(false);
      expect(validateCpf("123").isValid).toBe(false);
      expect(validateCpf("123456789012").isValid).toBe(false);
    });
  });

  describe("validatePayerName", () => {
    it("deve aceitar nome com sobrenome válido e normalizar espaços", () => {
      expect(validatePayerName("  João   Silva  ")).toBe("João Silva");
      expect(validatePayerName("Maria Souza Oliveira")).toBe("Maria Souza Oliveira");
    });

    it("deve rejeitar nome sem sobrenome", () => {
      expect(() => validatePayerName("João")).toThrowError("pelo menos nome e sobrenome");
      expect(() => validatePayerName("A B")).toThrowError();
    });

    it("deve rejeitar nome contendo apenas números", () => {
      expect(() => validatePayerName("12345 67890")).toThrowError("não pode conter apenas números");
    });

    it("deve rejeitar nome vazio ou muito curto", () => {
      expect(() => validatePayerName("")).toThrowError("Nome completo é obrigatório");
      expect(() => validatePayerName("Jo")).toThrowError("no mínimo 3 caracteres");
    });
  });

  describe("validatePayerEmail", () => {
    it("deve normalizar email para lowercase e trim", () => {
      expect(validatePayerEmail("  User.Test@Flance.com.BR ")).toBe("user.test@flance.com.br");
    });

    it("deve rejeitar formatos de email inválidos", () => {
      expect(() => validatePayerEmail("not-an-email")).toThrowError("E-mail informado é inválido");
      expect(() => validatePayerEmail("@flance.com")).toThrowError();
      expect(() => validatePayerEmail("")).toThrowError("E-mail é obrigatório");
    });
  });

  describe("validatePayerData", () => {
    it("deve retornar dados limpos e validados", () => {
      const result = validatePayerData({
        name: "  Carlos   Drummond  ",
        email: " Carlos@Email.COM ",
        cpf: " 529.982.247-25 ",
      });

      expect(result).toEqual({
        name: "Carlos Drummond",
        email: "carlos@email.com",
        cpf: "52998224725",
      });
    });
  });
});
