import { createContext, useContext, type ReactNode } from "react";
import type { AuthService } from "./auth/authService.ts";

export interface Services {
  auth: AuthService;
}

const ServicesContext = createContext<Services | null>(null);

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

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services)
    throw new Error("useServices must be used inside ServicesProvider");
  return services;
}
