/**
 * What this file does: renders the main dashboard entry point.
 * What calls it: the root route.
 * What it calls: the Dashboard client component.
 * Junior trap: putting request logic here instead of delegating to hooks and API routes.
 */
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function HomePage() {
  return <Dashboard />;
}
