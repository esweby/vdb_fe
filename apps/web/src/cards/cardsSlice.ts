import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { CardRepository, CardSummary } from "./cardRepository.ts";

export interface CardsState {
  status: "idle" | "loading" | "loaded" | "failed";
  items: CardSummary[];
  error: string | null;
}

const initialState: CardsState = { status: "idle", items: [], error: null };

export const loadCards = createAsyncThunk<
  CardSummary[],
  void,
  { extra: { cards: CardRepository }; state: { cards: CardsState } }
>("cards/load", (_arg, { extra }) => extra.cards.listCards(), {
  // Cards rarely change; load them once per session.
  condition: (_arg, { getState }) =>
    getState().cards.status === "idle" || getState().cards.status === "failed",
});

const cardsSlice = createSlice({
  name: "cards",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCards.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadCards.fulfilled, (state, action) => {
        state.status = "loaded";
        state.items = action.payload;
      })
      .addCase(loadCards.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Couldn't load cards";
      });
  },
});

export const cardsReducer = cardsSlice.reducer;
