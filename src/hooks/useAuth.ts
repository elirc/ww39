"use client";

/**
 * What this file does: wraps auth session reads and login/logout mutations.
 * What calls it: LoginPanel and Dashboard.
 * What it calls: /api/auth/* endpoints through apiJson.
 * Junior trap: caching auth state in local component state instead of query cache.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/hooks/apiClient";

type MeResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "ADMIN" | "MANAGER" | "AGENT" | "CUSTOMER";
    supportGroupId: string | null;
  };
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiJson<MeResponse>("/api/auth/me")
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiJson<MeResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }
  });
}
