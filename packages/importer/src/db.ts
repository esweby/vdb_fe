// Upserts imported cards. Safe to re-run: imported facts and attributes are
// replaced, curator decisions (fringe, hidden) are kept.
import type { Sql } from "postgres";
import type { ImportCard } from "./map.ts";

export async function upsertCards(
  sql: Sql,
  cards: ImportCard[],
): Promise<void> {
  await sql.begin(async (tx) => {
    for (const card of cards) {
      const [row] = await tx<{ id: string }[]>`
        insert into public.cards
          (external_id, name, type, subtypes, classes, talents, keywords, text, attributes, attributes_verified,
           first_set, first_released)
        values
          (${card.externalId}, ${card.name}, ${card.type}, ${card.subtypes}, ${card.classes}, ${card.talents},
           ${card.keywords}, ${card.text}, ${tx.json(card.attributes as never)}, ${card.attributesVerified},
           ${card.firstRelease?.name ?? null}, ${card.firstRelease?.released ?? null})
        on conflict (external_id) do update set
          name = excluded.name,
          type = excluded.type,
          subtypes = excluded.subtypes,
          classes = excluded.classes,
          talents = excluded.talents,
          keywords = excluded.keywords,
          text = excluded.text,
          attributes = excluded.attributes,
          attributes_verified = excluded.attributes_verified,
          first_set = excluded.first_set,
          first_released = excluded.first_released,
          updated_at = now()
        returning id`;

      for (const v of card.variants) {
        await tx`
          insert into public.variants (card_id, external_id, pitch, cost, power, defense, text, image_url, attributes)
          values (${row!.id}, ${v.externalId}, ${v.pitch}, ${v.cost}, ${v.power}, ${v.defense}, ${v.text},
                  ${v.imageUrl ?? null}, ${tx.json(v.attributes as never)})
          on conflict (external_id) do update set
            card_id = excluded.card_id,
            pitch = excluded.pitch,
            cost = excluded.cost,
            power = excluded.power,
            defense = excluded.defense,
            text = excluded.text,
            image_url = excluded.image_url,
            attributes = excluded.attributes`;
      }
    }
  });
}

/**
 * Hides cards that are no longer playable (banned, suspended or Living Legend in Classic
 * Constructed). Hidden, not deleted, so scores and decks that mention them keep working.
 */
export async function hideRetired(
  sql: Sql,
  externalIds: string[],
): Promise<number> {
  if (externalIds.length === 0) return 0;
  const rows = await sql`
    update public.cards set hidden = true, updated_at = now()
     where external_id in ${sql(externalIds)} and not hidden
    returning id`;
  return rows.length;
}
