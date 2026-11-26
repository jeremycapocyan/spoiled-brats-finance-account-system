import type { Profile, Role } from "./model";
export const roleNames: Record<Role, string> = { admin: "Administrator", cashier: "Cashier", viewer: "Finance viewer", employee: "Employee" };
export const canReadFinance = (p: Profile | null) => !!p?.active && ["admin", "viewer"].includes(p.role);
export const canSell = (p: Profile | null) => !!p?.active && ["admin", "cashier"].includes(p.role);
export function requireOwner(p: Profile) { if (!p.active || !p.is_owner || p.role !== "admin") throw new Error("Only the owner can manage user accounts."); }
export function validateAccountChange(actor: Profile, target: Profile, role: unknown, active: unknown) {
  requireOwner(actor);
  if (!(typeof role === "string" && Object.hasOwn(roleNames, role)) || typeof active !== "boolean") throw new Error("Choose a valid role and account status.");
  if (target.is_owner || target.id === actor.id) throw new Error("The owner account is protected.");
}
