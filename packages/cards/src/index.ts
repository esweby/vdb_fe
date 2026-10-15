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
  rolesOf,
  fits,
  type Engine,
  type RoleKind,
  type RoleCard,
  type RoleDef,
} from "./roles.ts";
