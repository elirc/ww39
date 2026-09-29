"use client";

/**
 * What this file does: renders one ticket row and wires its per-ticket mutations.
 * What calls it: the Dashboard list renderer.
 * What it calls: status, assignment, and comment hooks for a single ticket id.
 * Junior trap: putting hooks inside a loop in the parent component instead of isolating the ticket row.
 */
import { useState } from "react";
import { useAddComment, useAssignTicket, useUpdateTicketStatus } from "@/hooks/useTickets";

type Ticket = {
  id: string;
  number: number;
  subject: string;
  description: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "NEW" | "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
  supportGroupId: string;
};

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const [commentBody, setCommentBody] = useState("");
  const [assignmentTarget, setAssignmentTarget] = useState("");
  const updateStatus = useUpdateTicketStatus(ticket.id);
  const assignTicket = useAssignTicket(ticket.id);
  const addComment = useAddComment(ticket.id);

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Ticket #{ticket.number}</p>
          <h3 className="mt-1 text-lg font-medium">{ticket.subject}</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">{ticket.description}</p>
        </div>
        <div className="text-sm text-slate-300">
          <div>Status: {ticket.status}</div>
          <div>Priority: {ticket.priority}</div>
          <div>Group: {ticket.supportGroupId}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <button
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-amber-400"
          onClick={() => updateStatus.mutate({ status: "OPEN" })}
        >
          Open
        </button>
        <button
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-amber-400"
          onClick={() => updateStatus.mutate({ status: "RESOLVED" })}
        >
          Resolve
        </button>
        <button
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-amber-400"
          onClick={() => updateStatus.mutate({ status: "CLOSED" })}
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:border-amber-400"
          placeholder="Add a comment"
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
        />
        <button
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-amber-400"
          onClick={() => addComment.mutate({ body: commentBody, isInternal: false })}
        >
          Comment
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:border-amber-400"
          placeholder="Assignee ID"
          value={assignmentTarget}
          onChange={(event) => setAssignmentTarget(event.target.value)}
        />
        <button
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-amber-400"
          onClick={() =>
            assignTicket.mutate({
              assigneeId: assignmentTarget || null,
              reason: "Manual reassignment from dashboard"
            })
          }
        >
          Assign
        </button>
      </div>
    </article>
  );
}
