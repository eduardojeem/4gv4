const { PGlite } = require('@electric-sql/pglite')
const { readFileSync, readdirSync } = require('node:fs')
const assert = require('node:assert/strict')
async function main() {
 const db = new PGlite()
 try {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table sales(id uuid default gen_random_uuid(),organization_id uuid,branch_id uuid,total_amount numeric,created_at timestamptz,status text);
   create table branches(id uuid,organization_id uuid,is_active boolean);
   create function user_has_branch_access(branch uuid,actor uuid default auth.uid()) returns boolean language sql stable as $$select actor='00000000-0000-4000-8000-000000000002'::uuid and branch<>'00000000-0000-4000-8000-000000000004'::uuid$$;
   create table organization_members(organization_id uuid,user_id uuid,status text);
   create function has_org_permission(org uuid,perm text) returns boolean language sql stable as $$select exists(select 1 from organization_members where organization_id=org and user_id=auth.uid() and status='active')$$;
   alter table sales enable row level security;
   create policy tenant_branch_sales on sales for select to authenticated using(organization_id='00000000-0000-4000-8000-000000000001');
   grant usage on schema auth to authenticated; grant select on sales,organization_members,branches to authenticated;
   insert into branches values
    ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',true),
    ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',true),
    ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001',false),
    ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000009',true);
   insert into organization_members values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','active');
   insert into sales(organization_id,branch_id,total_amount,created_at,status)
    select '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003',10,'2026-10-15T12:00Z','completed' from generate_series(1,1250);
   insert into sales(organization_id,branch_id,total_amount,created_at,status) values
    ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003',999,'2026-10-15T12:00Z',' CANCELADA '),
    ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004',999,'2026-10-15T12:00Z','completed'),
    ('00000000-0000-4000-8000-000000000001',null,7,'2026-10-15T12:00Z','completed'),
    ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005',999,'2026-10-15T12:00Z','completed'),
    ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000006',999,'2026-10-15T12:00Z','completed'),
    ('00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000003',999,'2026-10-15T12:00Z','completed'),
    ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003',5,'2026-10-01T01:00Z','pending');`)
  const migration=readdirSync('supabase/migrations').find(name=>name.endsWith('_dashboard_customer_monthly_summary.sql'))
  await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'))
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false); set role authenticated`)
  const call=(org='00000000-0000-4000-8000-000000000001',start='2026-09-01T00:00Z',end='2026-10-31T23:59Z',zone='America/Asuncion')=>db.query('select * from dashboard_customer_monthly_summary($1,$2,$3,$4)',[org,start,end,zone])
  const result=(await call()).rows
  assert.deepEqual(result.map(row=>[row.month_index,Number(row.revenue),Number(row.sale_count)]),[[8,5,1],[9,12507,1251]])
  assert.equal((await call(undefined,'2026-01-01T00:00Z','2026-02-01T00:00Z')).rows.length,0)
  await assert.rejects(call('00000000-0000-4000-8000-000000000009'),/MONTHLY_SUMMARY_FORBIDDEN/)
  await assert.rejects(call(undefined,undefined,undefined,'Invalid/Zone'),/time zone|MONTHLY_SUMMARY_INVALID/)
  await assert.rejects(call(undefined,'2024-01-01T00:00Z','2026-10-31T23:59Z'),/MONTHLY_SUMMARY_INVALID/)
  await db.exec('reset role; revoke select on sales from authenticated; set role authenticated')
  await assert.rejects(call(),/permission denied/)
  console.log('PASS: monthly aggregate >1000 sales; cancellation aliases; zero series; browser-zone boundary; org-only RLS plus explicit assigned/active/org branch checks and legacy branchless rows; errors stay errors.')
 } finally { await db.close() }
}
main().catch(error=>{console.error(error.message,error.where||'');process.exitCode=1})
