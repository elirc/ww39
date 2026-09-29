/**
 * What this file does: hashes and verifies passwords for session login.
 * What calls it: AuthService and seed scripts.
 * What it calls: bcryptjs.
 * Junior trap: comparing passwords with plain string equality or forgetting to salt.
 */
import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

