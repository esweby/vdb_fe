import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { selectCanScore } from "../auth/authSlice.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { createCommunityRecalculation } from "./communityRecalculation.ts";

type Controller = ReturnType<typeof createCommunityRecalculation>;
const Context = createContext<Pick<Controller, "changed" | "flush"> | null>(
  null,
);

export function CommunityRecalculationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { scores } = useServices();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const canScore = useAppSelector(selectCanScore);
  const identity = useMemo(() => ({}), [userId, canScore, scores]);
  const active = useRef<{ identity: object; controller: Controller } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!userId || !canScore) return;
    const controller = createCommunityRecalculation(
      () => scores.runCommunityJob(),
      setFailed,
    );
    active.current = { identity, controller };
    return () => {
      controller.dispose();
      if (active.current?.controller === controller) active.current = null;
    };
  }, [identity, userId, canScore, scores]);

  // A save that finishes after sign-out must not schedule work for a different session.
  const actions = useMemo(() => {
    const current = () =>
      active.current?.identity === identity
        ? active.current.controller
        : undefined;
    return {
      changed: () => current()?.changed(),
      flush: () => current()?.flush(),
      retry: () => current()?.retry(),
    };
  }, [identity]);

  return (
    <Context.Provider value={actions}>
      {failed && (
        <p role="status">
          Your scores are saved, but the scoring group&apos;s scores have not
          updated yet.{" "}
          <button type="button" onClick={actions.retry}>
            Retry update
          </button>
        </p>
      )}
      {children}
    </Context.Provider>
  );
}

export function useCommunityRecalculation() {
  const value = useContext(Context);
  if (!value) throw new Error("CommunityRecalculationProvider is missing");
  return value;
}
