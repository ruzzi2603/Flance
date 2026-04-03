import { api } from "./api";

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

