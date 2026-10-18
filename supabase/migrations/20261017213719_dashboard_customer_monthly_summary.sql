-- Read-only aggregate. SECURITY INVOKER retains sales RLS; branch scope is explicit.
begin;
create or replace function public.dashboard_customer_monthly_summary(
  p_organization_id uuid,p_start timestamptz,p_end timestamptz,p_time_zone text
) returns table(year integer,month_index integer,revenue numeric,sale_count bigint)
language plpgsql stable security invoker set search_path=pg_catalog,public,auth as $$
declare v_allowed_branches uuid[];
begin
  if auth.uid() is null or not public.has_org_permission(p_organization_id,'crm.customers.read') then
    raise exception 'MONTHLY_SUMMARY_FORBIDDEN' using errcode='42501';
  end if;
  if p_organization_id is null or p_start is null or p_end is null or p_start>p_end or p_end-p_start>interval '400 days'
    or p_time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone) then
    raise exception 'MONTHLY_SUMMARY_INVALID_RANGE';
  end if;
  -- Check access once per active tenant branch, never once per historical sale.
  select coalesce(array_agg(b.id),'{}'::uuid[]) into v_allowed_branches
    from public.branches b
    where b.organization_id=p_organization_id and b.is_active
      and public.user_has_branch_access(b.id,auth.uid());
  return query
    select extract(year from s.created_at at time zone p_time_zone)::integer,
      extract(month from s.created_at at time zone p_time_zone)::integer-1,
      coalesce(sum(s.total_amount),0)::numeric,count(*)::bigint
    from public.sales s
    where s.organization_id=p_organization_id and s.created_at>=p_start and s.created_at<=p_end
      and (s.branch_id is null or s.branch_id=any(v_allowed_branches))
      and lower(btrim(coalesce(s.status,''))) not in ('cancelled','cancelada','cancelado')
    group by 1,2 order by 1,2;
end $$;
revoke all on function public.dashboard_customer_monthly_summary(uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.dashboard_customer_monthly_summary(uuid,timestamptz,timestamptz,text) to authenticated,service_role;
commit;
