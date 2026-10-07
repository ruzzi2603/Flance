import { api } from "./api";

/** Cópia dos meus dados (LGPD: acesso e portabilidade). Exige a senha. */
export async function exportMyData(password: string): Promise<Record<string, unknown>> {
  const response = await api.post<{ success: boolean; data: Record<string, unknown> }>("/privacy/export", { password });
  return response.data.data;
}

/** Exclui a conta (ou anonimiza, se houver histórico financeiro). Exige senha e a palavra EXCLUIR. */
export async function deleteMyAccount(password: string, confirmation: string): Promise<{ deleted: boolean; anonymized: boolean }> {
  const response = await api.post<{ success: boolean; data: { deleted: boolean; anonymized: boolean } }>("/privacy/delete-account", {
    password,
    confirmation,
  });
  return response.data.data;
}
