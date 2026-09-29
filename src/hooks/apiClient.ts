/**
 * What this file does: provides one fetch helper with JSON parsing and credentials included.
 * What calls it: React Query hooks for auth and ticket flows.
 * What it calls: browser fetch.
 * Junior trap: forgetting credentials on session-based requests and debugging a fake "auth bug."
 */
export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    credentials: "include"
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? "Request failed";
    throw new Error(message);
  }

  return body as T;
}
