import { api } from "./api";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "CLIENT" | "FREELANCER" | "ADMIN";
  createdAt: string;
  companyEnabled: boolean;
  companyName?: string | null;
  bannedAt?: string | null;
  banReason?: string | null;
}

export interface AdminAd {
  id: string;
  name: string;
  email: string;
  companyName: string;
  companyDescription?: string | null;
  companyLocation?: string | null;
  companyEnabled: boolean;
  createdAt: string;
  bannedAt?: string | null;
}

export interface AdminAuditEvent {
  id: string;
  adminId: string;
  targetUserId?: string | null;
  targetEmail: string;
  targetName: string;
  action: "USER_ALERTED" | "AD_REMOVED" | "AD_RESTORED" | "USER_BANNED" | "USER_UNBANNED" | "USER_DELETED";
  reason: string;
  notificationStatus: "PENDING" | "SENT" | "FAILED";
  createdAt: string;
}

export async function listAdminUsers(query: string) {
  const response = await api.get("/admin/users", { params: { q: query, limit: 100 } });
  return response.data.data as { items: AdminUser[]; total: number };
}

export async function listAdminAds(query: string) {
  const response = await api.get("/admin/ads", { params: { q: query, limit: 100 } });
  return response.data.data as { items: AdminAd[]; total: number };
}

export async function listAdminAudit() {
  const response = await api.get("/admin/audit", { params: { limit: 100 } });
  return response.data.data as AdminAuditEvent[];
}

export async function alertAdminUser(id: string, reason: string) {
  const response = await api.post(`/admin/users/${id}/alert`, { reason });
  return response.data.data as { notified: boolean; notificationStatus: "SENT" | "FAILED" };
}

export async function banAdminUser(id: string, reason: string) {
  const response = await api.post(`/admin/users/${id}/ban`, { reason });
  return response.data.data as { banned: boolean; notificationStatus: "SENT" | "FAILED" };
}

export async function unbanAdminUser(id: string, reason: string) {
  const response = await api.post(`/admin/users/${id}/unban`, { reason });
  return response.data.data as { banned: boolean; notificationStatus: "SENT" | "FAILED" };
}

export async function deleteAdminUser(id: string, reason: string) {
  const response = await api.delete(`/admin/users/${id}`, { data: { reason } });
  return response.data.data as { deleted: boolean; notificationStatus: "SENT" | "FAILED" };
}

export async function moderateAdminAd(id: string, active: boolean, reason: string) {
  const response = await api.patch(`/admin/ads/${id}`, { active, reason });
  return response.data.data as { active: boolean; notificationStatus: "SENT" | "FAILED" };
}