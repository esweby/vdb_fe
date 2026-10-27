import type { Visibility } from "./deckRepository.ts";

/** The visibility choices, in order, with what each means. */
export const VISIBILITIES: {
  value: Visibility;
  label: string;
  hint: string;
}[] = [
  { value: "private", label: "Private", hint: "Only you can see it." },
  {
    value: "link",
    label: "Link only",
    hint: "Anyone with the link can see it. It isn't listed in Public decks.",
  },
  {
    value: "public",
    label: "Public",
    hint: "Anyone can see it, and it's listed in Public decks.",
  },
];

export const visibilityLabel = (v: Visibility) =>
  VISIBILITIES.find((option) => option.value === v)!.label;
