// Card and attribute types shared by the web app, scoring and the importer.

export type Side = "forsaken" | "usurper";

export * from "./attributes.ts";
export { describeAttributes, describeAttributeSections } from "./describe.ts";
export * from "./groups.ts";
export * from "./routes.ts";
export { relevantDimensions } from "./relevance.ts";
export { hasConditions } from "./conditions.ts";
export {
  ROLES,
  ROLE_IDS,
  rolesOf,
  fits,
  type Engine,
  type RoleId,
  type RoleKind,
  type RoleCard,
  type RoleDef,
} from "./roles.ts";
export {
  SYNERGY_RULES,
  deriveSynergies,
  type SynergyCard,
  type SynergyEdge,
  type SynergyRule,
  type SynergyRuleId,
  type RoleRule,
  type ReferenceRule,
} from "./synergy.ts";
