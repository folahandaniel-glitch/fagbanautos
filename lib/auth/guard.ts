import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/** For server actions and route handlers: throws AuthError (401/403). Backend enforcement, not UI hiding. */
export async function requirePermission(permission: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Authentication required");
  if (user.kind !== "STAFF" || !user.permissions.has(permission)) throw new AuthError(403, `Missing permission: ${permission}`);
  return user;
}

export async function requireAnyPermission(...permissions: string[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Authentication required");
  if (user.kind !== "STAFF" || !permissions.some((p) => user.permissions.has(p))) throw new AuthError(403, "Insufficient permissions");
  return user;
}

export async function requireCustomer(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Authentication required");
  return user;
}

/** For pages: redirect instead of throwing. */
export async function requireStaffPage(permission?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.kind !== "STAFF") redirect("/admin/login");
  if (user.mustChangePassword) redirect("/admin/change-password");
  if (permission && !user.permissions.has(permission)) redirect("/admin?denied=1");
  return user;
}

export async function requireCustomerPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/account/login");
  return user;
}

export function authErrorResponse(err: unknown): Response | null {
  if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
  return null;
}
