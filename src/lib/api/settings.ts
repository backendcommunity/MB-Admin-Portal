import { axiosInstance } from "./axios";

export interface SettingItem {
  value: any;
  description: string;
  updatedAt: string;
}

export type SettingsDict = Record<string, SettingItem>;

export async function getSettings(): Promise<SettingsDict> {
  const { data } = await axiosInstance.get("/admin/settings");
  return data.data;
}

export async function updateSettings(updates: Record<string, any>): Promise<void> {
  await axiosInstance.put("/admin/settings", updates);
}
