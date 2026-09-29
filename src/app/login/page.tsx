/**
 * What this file does: renders the login screen for session creation.
 * What calls it: the /login route.
 * What it calls: the LoginPanel client component.
 * Junior trap: handling auth state here instead of inside the login API and query hooks.
 */
import { LoginPanel } from "@/components/auth/LoginPanel";

export default function LoginPage() {
  return <LoginPanel />;
}
