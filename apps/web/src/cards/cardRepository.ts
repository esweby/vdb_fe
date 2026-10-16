// Card data the app reads, behind an interface so tests can use a fake.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthoredCardAttributes, CardAttributes } from "@vdb/cards";

export interface VariantSummary {
  id: string;
  pitch: number | null;
  cost: number | null;
  power: number | null;
  defense: number | null;
  /** The official card image, when the dataset has one. */
  imageUrl?: string | null;
  /** This pitch's overrides, merged over the card's attributes. */
  attributes: AuthoredCardAttributes;
}

export interface CardSummary {
  id: string;
  name: string;
  type: string;
  subtypes: string[];
  classes: string[];
  talents: string[];
  keywords: string[];
  attributes: CardAttributes;
  attributesVerified: boolean;
  /** The set the card first came out in, and when (YYYY-MM-DD); null when undated. */
  firstSet?: string | null;
  firstReleased?: string | null;
  variants: VariantSummary[];
}

export interface CardRepository {
  listCards(): Promise<CardSummary[]>;
}

const PAGE = 1000;

export function supabaseCardRepository(client: SupabaseClient): CardRepository {
  return {
    async listCards() {
      const cards: CardSummary[] = [];
      // PostgREST returns at most 1,000 rows per request.
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from("cards")
          .select(
            "id, name, type, subtypes, classes, talents, keywords, attributes, attributesVerified:attributes_verified, firstSet:first_set, firstReleased:first_released, variants(id, pitch, cost, power, defense, imageUrl:image_url, attributes)",
          )
          .eq("hidden", false)
          .order("name")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        cards.push(...(data as CardSummary[]));
        if (data.length < PAGE) return cards;
      }
    },
  };
}
