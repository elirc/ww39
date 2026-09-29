"use client";

/**
 * What this file does: mounts the React Query client once for the entire app.
 * What calls it: the root layout.
 * What it calls: QueryClientProvider from React Query.
 * Junior trap: recreating the query client on every render and losing cache state.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
