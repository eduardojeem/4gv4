import { readFile } from 'node:fs/promises'
export const branch='66666666-6666-4666-8666-666666666666'
export const session='77777777-7777-4777-8777-777777777777'
/** Actual financial function bodies and financial table DDL; isolated DB only.
 * Peripheral tables are minimal fixtures, so this is not full Supabase proof.
 */
export async function setupPosFixture(db,org){
  const baseline=await readFile(new URL('../supabase/migrations/20260927000000_baseline_schema.sql',import.meta.url),'utf8')
  const functionSql=name=>{
    const sql=baseline.match(new RegExp(`CREATE OR REPLACE FUNCTION "public"\\."${name}"[\\s\\S]*?(?=\\r?\\nALTER FUNCTION)`))?.[0]
    if(!sql)throw new Error('Fixture function not found: '+name)
    return sql
  }
  const tableSql=name=>{
    const sql=baseline.match(new RegExp(`CREATE TABLE IF NOT EXISTS "public"\\."${name}"[\\s\\S]*?\\r?\\n\\);`))?.[0]
    if(!sql)throw new Error('Fixture table not found: '+name)
    return sql
  }
  await db.exec(`create schema extensions;
    create function extensions.uuid_generate_v4() returns uuid language sql as $$select gen_random_uuid()$$;
    create function public.get_default_branch_id() returns uuid language sql as $$select '${branch}'::uuid$$;
    alter table products add column wholesale_price numeric,add column stock_quantity numeric default 0,add column updated_at timestamptz;
    alter table customers add column credit_limit numeric;
    create table branches(id uuid primary key,organization_id uuid,is_active boolean);
    create table branch_inventory(branch_id uuid,product_id uuid,stock_quantity numeric,updated_at timestamptz);
    create table repairs(id uuid,organization_id uuid,branch_id uuid,payment_status text,final_cost numeric,estimated_cost numeric,paid_amount numeric,
      problem_description text,status text,picked_up_at timestamptz,delivered_at timestamptz,completed_at timestamptz,delivery_outcome text,updated_at timestamptz);
    create table customer_credits(id uuid default gen_random_uuid(),organization_id uuid,sale_id uuid,customer_id uuid,branch_id uuid,principal numeric,metadata jsonb,
      interest_rate numeric,term_months integer,start_date timestamptz,status text,credit_code text,credit_type text,origin_type text,label text);
    create table credit_installments(credit_id uuid,sale_id uuid,installment_number integer,due_date timestamptz,amount numeric,amount_paid numeric,status text,principal_component numeric,interest_component numeric);
    create table customer_store_credits(organization_id uuid,customer_id uuid,amount numeric,reason text,source_type text,source_id uuid,created_by uuid);
    create table product_variants(id uuid,product_id uuid,organization_id uuid,is_active boolean,wholesale_price numeric,sale_price numeric,variant_name text,sku text,attributes jsonb);
    create table branch_variant_inventory(variant_id uuid,branch_id uuid,organization_id uuid);
  `)
  const enumSql=baseline.match(/CREATE TYPE "public"\."cash_movement_type"[\s\S]*?\);/)?.[0]
  if(!enumSql)throw new Error('Fixture cash enum missing')
  await db.exec(enumSql)
  for(const name of ['sales','sale_items','sale_payments','cash_movements','cash_closures'])await db.exec(tableSql(name))
  await db.exec('alter table sales add primary key(id);create unique index sales_test_idempotency on sales(organization_id,idempotency_key)')
  for(const name of ['normalize_cash_closures_status_es','normalize_cash_movements_payment_method_es','pos_credit_checkout_summary','apply_pos_payment_metadata_atomic','process_pos_sale_atomic_v2','process_pos_sale_atomic_v3','process_pos_sale_atomic_v4','process_pos_sale_atomic_v5'])await db.exec(functionSql(name))
  await db.exec(`create trigger normalize_cash_status before insert or update on cash_closures for each row execute function normalize_cash_closures_status_es();
    create trigger normalize_cash_payment before insert or update on cash_movements for each row execute function normalize_cash_movements_payment_method_es();
    insert into branches values('${branch}','${org}',true);
    insert into cash_closures(id,organization_id,branch_id,type,register_id,date) values('${session}','${org}','${branch}','opening','test',null);
  `)
}
