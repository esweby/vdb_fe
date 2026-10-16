import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks.ts";
import { loadCards } from "./cardsSlice.ts";

/** The card list, loading it on first use; `retry` loads it again after a failure. */
export function useCards() {
  const dispatch = useAppDispatch();
  const cards = useAppSelector((s) => s.cards);
  useEffect(() => {
    void dispatch(loadCards());
  }, [dispatch]);
  const retry = useCallback(() => void dispatch(loadCards()), [dispatch]);
  return { ...cards, retry };
}
