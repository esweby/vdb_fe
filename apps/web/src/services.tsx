import type { ReactNode } from "react";
import { ServicesContext, type Services } from "./servicesContext.ts";

export type { Services } from "./servicesContext.ts";

export function ServicesProvider(props: {
  services: Services;
  children: ReactNode;
}) {
  return (
    <ServicesContext.Provider value={props.services}>
      {props.children}
    </ServicesContext.Provider>
  );
}
