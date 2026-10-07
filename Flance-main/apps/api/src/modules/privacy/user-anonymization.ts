/**
 * Dados aplicados a um usuário que precisa ser "excluído" mas tem histórico financeiro
 * (pagamentos, assinatura, aceite de contrato) que a lei e a Política de Privacidade obrigam a guardar.
 * Remove tudo o que identifica a pessoa; mantém só o vínculo e o identificador do Asaas (conciliação).
 */
export function buildAnonymizedUserData(userId: string, now = new Date()) {
  return {
    name: "Usuário removido",
    // ".invalid" é um TLD reservado: nunca recebe e-mail. O id mantém o e-mail único.
    email: `removido+${userId}@excluido.invalid`,
    // Não é um hash válido: ninguém consegue autenticar com esta conta
    password: "!conta-excluida",
    emailVerifiedAt: null,
    bannedAt: now,
    banReason: "Conta excluída",
    cpf: null,
    cpfEncrypted: null,
    bio: null,
    avatarUrl: null,
    headline: null,
    services: null,
    servicesTags: [],
    needs: null,
    companyEnabled: false,
    companyName: null,
    companyCnpj: null,
    companyDescription: null,
    companyLocation: null,
    companyCity: null,
    companyState: null,
    companyAddress: null,
    companyWebsite: null,
    companyInstagram: null,
    companyWhatsapp: null,
    companyEmail: null,
    companyHours: null,
    companyPhotos: [],
  };
}

export const isAnonymizedEmail = (email: string) => email.endsWith("@excluido.invalid");
