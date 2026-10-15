import type { Engine, RoleId } from "@vdb/cards";

export interface EngineDef {
  id: Engine;
}
export const engineOrder = (_side: string): EngineDef[] => [];
export const inLane = (_r: RoleId[], _e: Engine, _k: string) => false;
export const partners = (
  _n: string,
  _r: RoleId[],
  _c: { name: string; roles: RoleId[]; quantity: number }[],
): string[] => [];
export const balance = (
  _c: { name: string; roles: RoleId[]; quantity: number }[],
  _e: Engine,
) => ({ generators: -1, payoffs: -1 });
