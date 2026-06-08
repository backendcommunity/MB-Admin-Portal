import { axiosInstance } from "@/lib/api/axios";

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  plan?: string;
  joinedAt?: string;
};

export async function fetchUsers(params?: { page?: number; limit?: number; q?: string }) {
  const response = await axiosInstance.get<{ data: User[]; total: number }>("/users", {
    params,
  });
  return response.data;
}

export async function createUser(payload: Partial<User>) {
  const response = await axiosInstance.post<User>("/users", payload);
  return response.data;
}

export async function updateUser(payload: Partial<User> & { id: number }) {
  const response = await axiosInstance.put<User>(`/users/${payload.id}`, payload);
  return response.data;
}

export async function deleteUser(id: number) {
  const response = await axiosInstance.delete("/users", { params: { id } });
  return response.data;
}

export async function fetchUserById(id: number) {
  const response = await axiosInstance.get<User>(`/users/${id}`);
  return response.data;
}

export async function suspendUserById(id: number, active: boolean) {
  const response = await axiosInstance.patch<User>(`/users/${id}`, {
    action: "suspend",
    active,
  });
  return response.data;
}

export async function updateUserRole(id: number, role: string) {
  const response = await axiosInstance.patch<User>(`/users/${id}`, {
    action: "role",
    role,
  });
  return response.data;
}

export async function resetUserPassword(id: number) {
  const response = await axiosInstance.patch<{ success: boolean; message: string }>(
    `/users/${id}`,
    { action: "reset-password" }
  );
  return response.data;
}
