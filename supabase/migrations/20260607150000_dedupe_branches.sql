-- Dedupe branches by (organization_id, slug).
--
-- Failed onboarding retries could create more than one branch with the same
-- (organization_id, slug='principal'). This keeps one canonical branch per
-- (org, slug) and removes the safe duplicates.
--
-- SAFE BY DESIGN: a duplicate is deleted ONLY when no other table references it
-- (no inventory, sales, movements, assignments, etc.). Duplicates that DO have
-- dependent rows are left untouched and reported via NOTICE for manual review,
-- so no inventory/sales data is ever orphaned.

do $$
declare
  dup record;
  fk record;
  ref_count bigint;
begin
  -- Map duplicates: every branch that is NOT the keeper for its (org, slug).
  -- Keeper preference: is_default first, then lowest id as a stable tiebreaker.
  create temporary table _branch_dups on commit drop as
  with ranked as (
    select
      id,
      first_value(id) over (
        partition by organization_id, slug
        order by is_default desc nulls last, id
      ) as keeper_id
    from public.branches
  )
  select id as dup_id
  from ranked
  where id <> keeper_id;

  if not exists (select 1 from _branch_dups) then
    raise notice 'No hay sucursales duplicadas por (organization_id, slug).';
    return;
  end if;

  for dup in select dup_id from _branch_dups loop
    ref_count := 0;

    -- Count references to this duplicate across every FK that points at branches.
    for fk in
      select con.conrelid::regclass as child_table, att.attname as child_col
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
      where con.contype = 'f'
        and con.confrelid = 'public.branches'::regclass
    loop
      execute format('select count(*) from %s where %I = $1', fk.child_table, fk.child_col)
        into ref_count
        using dup.dup_id;
      exit when ref_count > 0;
    end loop;

    if ref_count = 0 then
      delete from public.branches where id = dup.dup_id;
      raise notice 'Sucursal duplicada eliminada: %', dup.dup_id;
    else
      raise notice 'Sucursal duplicada CONSERVADA (tiene % filas dependientes) — revisar manualmente: %', ref_count, dup.dup_id;
    end if;
  end loop;
end $$;
