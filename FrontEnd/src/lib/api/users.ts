import { axiosInstance } from "@/lib/api/axios";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  plan?: string;
  status?: string;
  joinedAt?: string;
};

export type UsersListResponse = {
  data: User[];
  total: number;
  page?: number;
  limit?: number;
};

// Fetch users with pagination, filtering, and sorting
export async function fetchUsers(params?: {
  page?: number;
  limit?: number;
  q?: string;
  role?: string;
  active?: string;
  sort?: string;
  order?: string;
}) {
  const response = await axiosInstance.get<UsersListResponse>("/admin/users", {
    params,
  });
  return response.data;
}

// Create new user
export async function createUser(payload: Partial<User>) {
  const response = await axiosInstance.post<User>("/admin/users", payload);
  return response.data;
}

// Update user (generic)
export async function updateUser(payload: Partial<User> & { id: string }) {
  const response = await axiosInstance.put<User>(`/admin/users/${payload.id}`, payload);
  return response.data;
}

// Delete user
export async function deleteUser(id: string) {
  const response = await axiosInstance.delete<{ success: boolean }>(`/admin/users/${id}`);
  return response.data;
}

// Fetch single user by ID
export async function fetchUserById(id: string) {
  const response = await axiosInstance.get<User>(`/admin/users/${id}`);
  return response.data;
}

// Suspend/reactivate user
export async function suspendUserById(id: string, active: boolean) {
  const response = await axiosInstance.patch<User>(`/admin/users/${id}/suspend`, {
    active,
  });
  return response.data;
}

// Change user role
export async function updateUserRole(id: string, role: string) {
  const response = await axiosInstance.patch<User>(`/admin/users/${id}/role`, {
    role,
  });
  return response.data;
}

// Reset user password (sends email)
export async function resetUserPassword(id: string) {
  const response = await axiosInstance.post<{ success: boolean; message: string }>(
    `/admin/users/${id}/reset-password`
  );
  return response.data;
}
