/**
 * What this file does: defines the login payload boundary for auth routes.
 * What calls it: auth route handlers and tests.
 * What it calls: zod.
 * Junior trap: allowing empty emails or very short passwords into the service layer.
 */
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  // ⚠ SENIOR NOTE: keeping the password floor in the schema prevents a pointless auth lookup for garbage input.
  password: z.string().min(8).max(128)
});
