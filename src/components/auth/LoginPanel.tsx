"use client";

/**
 * What this file does: renders the login form and redirects after a successful session creation.
 * What calls it: the login page.
 * What it calls: useLogin and Next.js router navigation.
 * Junior trap: assuming the cookie alone is enough and never refetching auth state.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "@/hooks/useAuth";

export function LoginPanel() {
  const login = useLogin();
  const router = useRouter();
  const [email, setEmail] = useState("admin@atlas.local");
  const [password, setPassword] = useState("Password123!");

  return (
    <main className="min-h-screen px-6 py-12 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center justify-center">
        <section className="glass-panel w-full max-w-xl rounded-3xl p-8 shadow-glow">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400">Atlas Support</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Sign in to the ticketing console</h1>
          <p className="mt-3 text-sm text-slate-300">
            Authentication is session-based and backed by a server-side session row. Use a seeded account in development.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate(
                { email, password },
                {
                  onSuccess: () => {
                    router.push("/");
                  }
                }
              );
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Email</span>
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 outline-none ring-0 focus:border-amber-400"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Password</span>
              <input
                type="password"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 outline-none ring-0 focus:border-amber-400"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="rounded-2xl bg-amber-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-amber-400"
              disabled={login.isPending}
            >
              {login.isPending ? "Signing in..." : "Sign in"}
            </button>
            {login.error ? <p className="text-sm text-rose-300">{login.error.message}</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}
