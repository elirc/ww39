"use client";

/**
 * What this file does: shows the operational ticket dashboard and create-ticket form.
 * What calls it: the root page.
 * What it calls: auth/ticket React Query hooks and the TicketCard child component.
 * Junior trap: letting the dashboard decide business rules that belong in services.
 */
import { useEffect, useState } from "react";
import { useMe, useLogout } from "@/hooks/useAuth";
import { useCreateTicket, useTickets } from "@/hooks/useTickets";
import { TicketCard } from "@/components/dashboard/TicketCard";

const defaultTicketForm = {
  subject: "",
  description: "",
  category: "General",
  priority: "NORMAL",
  requesterName: "",
  requesterEmail: "",
  supportGroupId: ""
};

export function Dashboard() {
  const me = useMe();
  const logout = useLogout();
  const tickets = useTickets(Boolean(me.data?.user));
  const createTicket = useCreateTicket();
  const [form, setForm] = useState(defaultTicketForm);

  useEffect(() => {
    const user = me.data?.user;
    if (!user) {
      return;
    }

    setForm((current) => {
      const next = {
        ...current,
        requesterName: current.requesterName || user.displayName,
        requesterEmail: current.requesterEmail || user.email,
        supportGroupId: current.supportGroupId || user.supportGroupId || current.supportGroupId
      };

      return next.requesterName === current.requesterName &&
        next.requesterEmail === current.requesterEmail &&
        next.supportGroupId === current.supportGroupId
        ? current
        : next;
    });
  }, [me.data?.user]);

  const visibleTickets = tickets.data?.tickets ?? [];

  return (
    <main className="min-h-screen px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="glass-panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-amber-400">Atlas Support</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Support operations console</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">
                Tickets route through API handlers, service rules, and repository-scoped queries. The same path is what the docs trace.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              {me.data?.user ? (
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium text-slate-100">{me.data.user.displayName}</div>
                    <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{me.data.user.role}</div>
                  </div>
                  <button
                    className="rounded-xl border border-slate-700 px-3 py-2 text-slate-100 transition hover:border-amber-400"
                    onClick={() => logout.mutate()}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-slate-100">Not signed in</div>
                  <a className="text-amber-400" href="/login">
                    Go to login
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            className="glass-panel rounded-[2rem] p-6"
            onSubmit={(event) => {
              event.preventDefault();
              createTicket.mutate(form);
            }}
          >
            <h2 className="text-xl font-semibold">Create ticket</h2>
            <div className="mt-5 space-y-3">
              {[
                ["subject", "Subject"],
                ["description", "Description"],
                ["category", "Category"],
                ["requesterName", "Requester name"],
                ["requesterEmail", "Requester email"],
                ["supportGroupId", "Support group ID"]
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.25em] text-slate-400">{label}</span>
                  <input
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-amber-400"
                    value={(form as Record<string, string>)[key]}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.25em] text-slate-400">Priority</span>
                <select
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-amber-400"
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>
              <button
                type="submit"
                className="w-full rounded-2xl bg-amber-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-amber-400"
                disabled={createTicket.isPending}
              >
                {createTicket.isPending ? "Creating..." : "Create ticket"}
              </button>
              {createTicket.error ? <p className="text-sm text-rose-300">{createTicket.error.message}</p> : null}
            </div>
          </form>

          <section className="glass-panel rounded-[2rem] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Visible tickets</h2>
              <button
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-100 transition hover:border-amber-400"
                onClick={() => tickets.refetch()}
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {tickets.isLoading ? <p className="text-sm text-slate-400">Loading tickets...</p> : null}
              {visibleTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
              {!tickets.isLoading && visibleTickets.length === 0 ? (
                <p className="text-sm text-slate-400">No tickets are visible to this user yet.</p>
              ) : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
