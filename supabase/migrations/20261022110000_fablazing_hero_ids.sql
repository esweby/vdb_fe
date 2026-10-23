-- FaBlazing hero ids. FaBlazing records the hero a side ended the game as, so a hero that
-- transformed shows up as its Demi-Hero: the importer maps each Demi-Hero to the hero it came
-- from, and matchups count a hero's forms as one opponent. Some ids are ignored (the maintainer's
-- call, 21 Oct 2026): they map to nothing, aren't listed as unmatched, and aren't shown as
-- matchups, though their games still count toward Viserai's total.

alter table public.fablazing_card_map
  add column ignored boolean not null default false;

alter table public.fablazing_card_map
  drop constraint fablazing_card_map_one_target,
  add constraint fablazing_card_map_one_target
    check (num_nonnulls(variant_id, hero_id) = case when ignored then 0 else 1 end);

-- As before, but one row per opposing hero rather than per FaBlazing id. opponent is one of that
-- hero's FaBlazing ids (the first), kept as the row's key; ids with no hero stay one row each.
create or replace view public.fablazing_viserai_matchups with (security_invoker = true) as
select x.format, x.opponent, x.hero_id, w.starts_on, w.latest,
       x.games, x.wins, x.abandoned, x.total_games
  from (select d.format, min(d.opponent) as opponent, m.hero_id,
               sum(d.games) as games, sum(d.wins) as wins, sum(d.abandoned) as abandoned,
               coalesce(bool_or(m.ignored), false) as ignored,
               (sum(sum(d.games)) over (partition by d.format))::bigint as total_games
          from public.fablazing_matchup_daily d
          join public.fablazing_window w
            on w.format = d.format and d.date between w.starts_on and w.latest
          left join public.fablazing_card_map m on m.slug = d.opponent
         where d.hero = 'viserai'
         group by d.format, m.hero_id, case when m.hero_id is null then d.opponent end) x
  join public.fablazing_window w on w.format = x.format
 where not x.ignored;
