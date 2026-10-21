-- FaBlazing app views (docs/fablazing-plan.md, step 3; next step 4): "In real games" on card pages,
-- Viserai's real matchups, and Effect drafts ordered by real plays. Each view sums the daily tables
-- over a rolling window of 30 days ending on the latest succeeded run for the format, and never
-- reaching back past the start of the rules window that day falls in. Sums only: the app works out
-- rates, Wilson intervals and the n >= 50 rule. They run with the reader's rights, so row level
-- security on the tables still applies.

-- One row per format: the window, and how fresh the data is.
create view public.fablazing_window with (security_invoker = true) as
select r.format, greatest(r.latest - 29, w.starts_on) as starts_on, r.latest
  from (select format, max(date) as latest
          from public.fablazing_runs
         where status = 'succeeded'
         group by format) r
  left join public.fablazing_rules_windows w
    on r.latest >= w.starts_on and (w.ends_on is null or r.latest < w.ends_on);

-- Viserai's detailed decks over the window, both sides together (Viserai is one hero): the
-- denominators for inclusion, and the baseline win rate.
create view public.fablazing_viserai_baseline with (security_invoker = true) as
select w.format, w.starts_on, w.latest,
       count(distinct r.date) as days,
       coalesce(sum((d.value ->> 'decks')::integer), 0) as decks,
       coalesce(sum((d.value ->> 'result_decks')::integer), 0) as result_decks,
       coalesce(sum((d.value ->> 'wins')::integer), 0) as wins
  from public.fablazing_window w
  join public.fablazing_runs r
    on r.format = w.format and r.status = 'succeeded' and r.date between w.starts_on and w.latest
  left join lateral jsonb_each(coalesce(r.decks, '{}')) d on true
 group by w.format, w.starts_on, w.latest;

-- Per FaBlazing card (one pitch of one of our cards) over the window, both sides together, with
-- our variant and card when the map knows the slug, and the baseline beside it.
create view public.fablazing_card_stats with (security_invoker = true) as
select c.format, c.card, m.variant_id, v.card_id,
       b.starts_on, b.latest,
       c.decks, c.copies, c.result_decks, c.played, c.pitched, c.blocked, c.hits, c.wins,
       b.decks as base_decks, b.result_decks as base_result_decks, b.wins as base_wins
  from (select d.format, d.card,
               sum(d.decks) as decks, sum(d.copies) as copies, sum(d.result_decks) as result_decks,
               sum(d.played) as played, sum(d.pitched) as pitched, sum(d.blocked) as blocked,
               sum(d.hits) as hits, sum(d.wins) as wins
          from public.fablazing_card_daily d
          join public.fablazing_window w
            on w.format = d.format and d.date between w.starts_on and w.latest
         group by d.format, d.card) c
  join public.fablazing_viserai_baseline b on b.format = c.format
  left join public.fablazing_card_map m on m.slug = c.card
  left join public.variants v on v.id = m.variant_id;

-- Viserai against each opposing hero over the window. games counts results only (abandoned games
-- are left out); total_games is every Viserai result in the window, for meta share.
create view public.fablazing_viserai_matchups with (security_invoker = true) as
select x.format, x.opponent, m.hero_id, w.starts_on, w.latest,
       x.games, x.wins, x.abandoned,
       (sum(x.games) over (partition by x.format))::bigint as total_games
  from (select d.format, d.opponent,
               sum(d.games) as games, sum(d.wins) as wins, sum(d.abandoned) as abandoned
          from public.fablazing_matchup_daily d
          join public.fablazing_window w
            on w.format = d.format and d.date between w.starts_on and w.latest
         where d.hero = 'viserai'
         group by d.format, d.opponent) x
  join public.fablazing_window w on w.format = x.format
  left join public.fablazing_card_map m on m.slug = x.opponent;

-- Grants: read only, for everyone. The tables' own grants and policies still apply underneath.
grant select on
  public.fablazing_window, public.fablazing_viserai_baseline, public.fablazing_card_stats,
  public.fablazing_viserai_matchups
  to anon, authenticated, service_role;
