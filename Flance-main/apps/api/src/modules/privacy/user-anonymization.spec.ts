import { describe, expect, it } from "vitest";
import { buildAnonymizedUserData, isAnonymizedEmail } from "./user-anonymization";

describe("anonimização de usuário com histórico financeiro", () => {
  const data = buildAnonymizedUserData("u1", new Date("2026-10-03T00:00:00Z"));

  it("remove CPF, contato, perfil e dados da empresa", () => {
    expect(data.cpf).toBeNull();
    expect(data.cpfEncrypted).toBeNull();
    expect(data.companyCnpj).toBeNull();
    expect(data.companyWhatsapp).toBeNull();
    expect(data.companyEmail).toBeNull();
    expect(data.companyPhotos).toEqual([]);
    expect(data.avatarUrl).toBeNull();
    expect(data.companyEnabled).toBe(false);
    expect(data.name).toBe("Usuário removido");
  });

  it("e-mail único, inválido para envio e reconhecível; ninguém consegue autenticar", () => {
    expect(data.email).toBe("removido+u1@excluido.invalid");
    expect(isAnonymizedEmail(data.email)).toBe(true);
    expect(isAnonymizedEmail("joao@email.com")).toBe(false);
    expect(data.password.startsWith("$2")).toBe(false); // não é hash bcrypt
    expect(data.bannedAt).toEqual(new Date("2026-10-03T00:00:00Z"));
  });
});
