import { axiosInstance } from "./axios";

export interface Offer {
  id: string;
  title: string;
  summary: string;
  description?: string | null;
  slug: string;
  isPremium: boolean;
  isWaiting: boolean;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedOffers {
  data: Offer[];
  total: number;
  page: number;
  limit: number;
}

export async function getOffers(params?: { page?: number; limit?: number; q?: string }): Promise<PaginatedOffers> {
  const { data } = await axiosInstance.get("/admin/offers", { params });
  return data;
}

export async function createOffer(payload: Partial<Offer>): Promise<Offer> {
  const { data } = await axiosInstance.post("/admin/offers", payload);
  return data.data;
}

export async function updateOffer(id: string, payload: Partial<Offer>): Promise<Offer> {
  const { data } = await axiosInstance.put(`/admin/offers/${id}`, payload);
  return data.data;
}

export async function deleteOffer(id: string): Promise<void> {
  await axiosInstance.delete(`/admin/offers/${id}`);
}
