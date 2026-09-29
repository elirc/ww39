/**
 * What this file does: defines the app shell, metadata, and top-level providers.
 * What calls it: the Next.js app router for every page render.
 * What it calls: global CSS and the React Query provider.
 * Junior trap: forgetting that global providers belong at the root, not in individual pages.
 */
import type { Metadata } from "next";
import "@/app/globals.css";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Atlas Support",
  description: "A production-style support ticketing platform for teams that need explicit SLAs and escalation rules."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
