import { API_BASE_URL, api } from "./api";

export interface CompanyProfile {
  id: string;
  ownerId: string;
  name: string;
  avatarUrl?: string;
  headline?: string;
  services?: string;
  servicesTags?: string[];
  bio?: string;
  companyName?: string;
  companyDescription?: string;
  companyLocation?: string;
  companyCity?: string;
  companyState?: string;
  companyAddress?: string;
  companyWebsite?: string;
  companyInstagram?: string;
  companyWhatsapp?: string;
  companyEmail?: string;
  companyHours?: string;
  companyPhotos?: string[];
  companyIsOnline?: boolean;
  companyIsPhysical?: boolean;
  companyViews?: number;
  planTier?: string;
  averageRating: number;
  reviewCount: number;
  qualifiedReviewCount: number;
  isTrusted: boolean;
  reviewMedal: "bronze" | "silver" | "gold" | null;
}

export interface CompanyReview {
  id: string;
  rating: number;
  comment?: string;
  author: { id: string; name: string; avatarUrl?: string };
  createdAt: string;
}

export interface CompanyAnalytics {
  periodDays: number;
  views: number;
  averageDurationSeconds: number;
  messages: number;
  peopleContacted: number;
  shares: number;
  shareSources: Array<{ source: string; count: number }>;
  daily: Array<{ date: string; views: number; messages: number; shares: number }>;
}

export async function listCompanies(params: { query?: string; limit?: number; offset?: number }) {
  const response = await api.get("/users/companies", {
    params: {
      q: params.query,
      limit: params.limit,
      offset: params.offset,
    },
  });
  return (response.data?.data ?? []) as CompanyProfile[];
}

export async function getCompany(id: string) {
  const response = await api.get(`/users/companies/${id}`);
  return response.data?.data as CompanyProfile;
}

export async function listCompanyReviews(id: string): Promise<CompanyReview[]> {
  const response = await api.get(`/users/companies/${id}/reviews`);
  return (response.data?.data ?? []) as CompanyReview[];
}

export async function reviewCompany(id: string, input: { rating: number; comment?: string }) {
  const response = await api.post(`/users/companies/${id}/reviews`, {
    rating: Number(input.rating),
    ...(input.comment ? { comment: input.comment } : {}),
  });
  return response.data?.data as CompanyReview;
}

export async function recordCompanyView(id: string, sessionId: string): Promise<{ id: string }> {
  const response = await api.post(`/users/companies/${id}/analytics/views`, { sessionId });
  return response.data.data as { id: string };
}

export async function recordCompanyViewDuration(id: string, visitId: string, durationSeconds: number) {
  await fetch(`${API_BASE_URL}/v1/users/companies/${id}/analytics/views/${visitId}/duration`, {
    method: "POST",
    keepalive: true,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSeconds }),
  });
}

export async function recordCompanyShare(
  id: string,
  sessionId: string,
  source: "native" | "copy" | "whatsapp" | "facebook" | "x" | "email",
) {
  await api.post(`/users/companies/${id}/analytics/shares`, { sessionId, source });
}

export async function getCompanyAnalytics(id: string): Promise<CompanyAnalytics> {
  const response = await api.get(`/users/companies/${id}/analytics`);
  return response.data.data as CompanyAnalytics;
}

