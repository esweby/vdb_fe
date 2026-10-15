// Roles and engines, first pass (docs/roles.md). UNVERIFIED: for the maintainer to correct.
import type { AuthoredCardAttributes, CardAttributes } from "./attributes.ts";

export type Engine = "runechant" | "gate" | "banish";
export type RoleKind = "generator" | "payoff" | "support";

export interface RoleCard {
  type: string;
  attributes: CardAttributes;
  variantAttributes?: Partial<AuthoredCardAttributes>[];
}

export interface RoleDef {
  id: string;
  name: string;
  engine: Engine | null;
  kind: RoleKind | null;
}

export const ROLES: RoleDef[] = [];

export function rolesOf(_card: RoleCard): string[] {
  return [];
}

export function fits(_a: string[], _b: string[]): boolean {
  return false;
}
