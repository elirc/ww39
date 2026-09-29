"use client";

/**
 * What this file does: exposes ticket queries and mutations to the UI.
 * What calls it: Dashboard and TicketCard.
 * What it calls: /api/tickets and nested ticket endpoints through apiJson.
 * Junior trap: sending ad hoc fetch calls from components instead of reusing typed mutation hooks.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/hooks/apiClient";

type Ticket = {
  id: string;
  number: number;
  subject: string;
  description: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "NEW" | "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
  requesterName: string;
  requesterEmail: string;
  supportGroupId: string;
  assigneeId: string | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TicketListResponse = { tickets: Ticket[] };

export function useTickets(enabled = true) {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiJson<TicketListResponse>("/api/tickets"),
    enabled
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiJson<{ ticket: Ticket }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }
  });
}

export function useUpdateTicketStatus(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: Ticket["status"]; note?: string }) =>
      apiJson<{ ticket: Ticket }>(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }
  });
}

export function useAssignTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { assigneeId?: string | null; supportGroupId?: string | null; reason: string }) =>
      apiJson<{ ticket: Ticket }>(`/api/tickets/${ticketId}/assign`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }
  });
}

export function useAddComment(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; isInternal: boolean }) =>
      apiJson<{ ok: boolean }>(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }
  });
}
