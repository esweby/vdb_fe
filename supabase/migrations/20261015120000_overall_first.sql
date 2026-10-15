-- Show overall first: it's the rating every card gets, and floor and ceiling refine it.
update public.score_dimensions set sort_order = case key
  when 'overall' then 1
  when 'floor' then 2
  when 'ceiling' then 3
  else sort_order
end;
