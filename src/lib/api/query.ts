"use client";

import type { AxiosRequestConfig } from "axios";
import {
  QueryClient,
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { normalizeMutationResponse, normalizeQueryResponse } from "@/lib/api/adapters";
import { axiosInstance } from "@/lib/api/axios";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000,
        refetchOnWindowFocus: false,
      },
    },
  });

export function useApiQuery<TData>(
  queryKey: unknown[],
  url: string,
  config?: AxiosRequestConfig,
  options?: Omit<UseQueryOptions<TData>, "queryKey" | "queryFn">
) {
  return useQuery<TData>({
    queryKey,
    queryFn: async () => {
      const response = await axiosInstance.get<TData>(url, config);
      return normalizeQueryResponse(url, response.data) as TData;
    },
    ...options,
  });
}

type ApiMutationOptions<TData, TVariables> = {
  url: string;
  method?: "post" | "put" | "patch" | "delete";
  config?: AxiosRequestConfig;
  mutationOptions?: Omit<
    UseMutationOptions<TData, Error, TVariables, unknown>,
    "mutationFn"
  >;
};

export function useApiMutation<TData, TVariables>(
  options: ApiMutationOptions<TData, TVariables>
) {
  const {
    url,
    method = "post",
    config,
    mutationOptions,
  } = options;

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const response = await axiosInstance.request<TData>({
        url,
        method,
        data: variables,
        ...config,
      });

      return normalizeMutationResponse(response.data) as TData;
    },
    ...mutationOptions,
  });
}
