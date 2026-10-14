import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks.ts";
import { loadCards } from "./cardsSlice.ts";

/** The card list, loading it on first use. */
export function useCards() {
  const dispatch = useAppDispatch();
  const cards = useAppSelector((s) => s.cards);
  useEffect(() => {
    void dispatch(loadCards());
  }, [dispatch]);
  return cards;
}
