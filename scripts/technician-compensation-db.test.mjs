import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
const db = new PGlite()
const org='11111111-1111-4111-8111-111111111111', actor='22222222-2222-4222-8222-222222222222', tech='33333333-3333-4333-8333-333333333333'
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create table organizations(id uuid primary key);
    create type organization_role as enum ('owner','admin','manager','technician','customer');
    create table organization_members(organization_id uuid,user_id uuid,role organization_role,status text);
    create table technician_payment_requests(organization_id uuid,request_key text,request jsonb,result jsonb,created_at timestamptz default now(),primary key(organization_id,request_key));
    create function public.assert_service_cash_actor(uuid) returns void language plpgsql as $$ begin if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if; end $$;
    create function public.has_org_permission(uuid,text) returns boolean language sql as $$ select current_setting('test.allowed',true)='true' $$;
    create function public.payroll_organization_date(uuid,timestamptz) returns date language sql as $$ select date '2026-10-13' $$;
    insert into organizations values('${org}'); insert into auth.users values('${actor}'),('${tech}');
    insert into organization_members values('${org}','${actor}','owner','active'),('${org}','${tech}','technician','active');
    select set_config('request.jwt.claim.role','service_role',false),set_config('test.allowed','true',false);`)
  const sql=await readFile(new URL('../supabase/migrations/20260927000000_baseline_schema.sql',import.meta.url),'utf8')
  for(const table of ['technician_compensation','employee_compensation','commission_rules','earned_commissions']) {
    await db.exec(sql.match(new RegExp('CREATE TABLE IF NOT EXISTS "public"\\."'+table+'" \\([\\s\\S]*?\\n\\);'))[0]+`; alter table ${table} add primary key(id);`)
  }
  await db.exec('alter table technician_compensation add unique(organization_id,technician_id)')
  await db.exec(sql.match(/CREATE OR REPLACE FUNCTION "public"\."protect_approved_commission_rule"\(\)[\s\S]*?\n\$\$;/)[0])
  await db.exec('create trigger commission_rules_20_protect_approved before update or delete on public.commission_rules for each row execute function public.protect_approved_commission_rule()')
  const file=(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(f=>f.endsWith('_technician_compensation_versions.sql'))
  await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
})
after(()=>db.close())
const config={base_salary:100,commission_rate:10,commission_base:'labor',fixed_per_repair:5,accrual_status:'entregado',salary_effective_from:null,effective_from:'2026-10-13'}
const save=(key,input=config,a=actor,t=tech)=>db.query('select public.server_save_technician_compensation($1,$2,$3,$4,$5) as result',[org,a,t,key,input]).then(r=>r.rows[0].result)
test('saves salary and both commission components atomically and idempotently',async()=>{
  await save('combined-config'); await save('combined-config')
  assert.equal((await db.query('select base_salary::int amount from employee_compensation')).rows[0].amount,100)
  const rules=(await db.query('select calculation_type,value::int from commission_rules order by calculation_type')).rows
  assert.deepEqual(rules,[{calculation_type:'fixed',value:5},{calculation_type:'percentage',value:10}])
  assert.equal((await db.query('select count(*)::int n from technician_compensation_versions')).rows[0].n,1)
})
test('zero settings close previous versions without rewriting their amounts',async()=>{
  await save('zero-config',{...config,base_salary:0,commission_rate:0,fixed_per_repair:0,effective_from:'2026-10-14'})
  const history=(await db.query('select base_salary::int amount,effective_to::text from employee_compensation order by effective_from')).rows
  assert.deepEqual(history,[{amount:100,effective_to:'2026-10-13'},{amount:0,effective_to:null}])
  assert.equal((await db.query("select count(*)::int n from commission_rules where effective_from='2026-10-14' and value=0")).rows[0].n,2)
})
test('a manual Finance rule conflict rolls back the whole change',async()=>{
  await db.query("insert into employee_compensation(organization_id,employee_id,base_salary,effective_from) values($1,$2,77,'2026-10-15')",[org,tech])
  await assert.rejects(save('manual-conflict',{...config,effective_from:'2026-10-15'}),/FINANCE_CONFIG_CONFLICT/)
  assert.equal((await db.query('select count(*)::int n from technician_compensation_versions')).rows[0].n,2)
})
test('rejects an unauthorized actor and changed retries',async()=>{
  await assert.rejects(save('technician-self-config',config,tech),/FORBIDDEN/)
  await assert.rejects(save('combined-config',{...config,base_salary:999}),/IDEMPOTENCY_CONFLICT/)
})
test('today cannot close an already approved rule before today',async()=>{
  const otherTech='99999999-9999-4999-8999-999999999999'
  await db.query('insert into auth.users values($1)',[otherTech])
  await db.query("insert into organization_members values($1,$2,'technician','active')",[org,otherTech])
  const old=(await db.query('insert into technician_compensation(organization_id,technician_id) values($1,$2) returning id',[org,otherTech])).rows[0].id
  await db.query("insert into commission_rules(organization_id,scope_type,employee_id,source_type,accrual_status,calculation_type,value,status,effective_from,legacy_source_id,legacy_component,legacy_cutover_on,approved_at) values($1,'employee',$2,'repair_labor','entregado','percentage',10,'approved','2026-09-01',$3,'percentage','2026-09-01',now())",[org,otherTech,old])
  await assert.rejects(save('today-rule-change',config,actor,otherTech),/FUTURE_DATE_REQUIRED/)
})
