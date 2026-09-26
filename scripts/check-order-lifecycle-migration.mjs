import { readFileSync, existsSync } from 'node:fs'
import { delimiter, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const root = (process.env.PATH ?? '').split(delimiter)
  .map(path => resolve(path, '..', '@electric-sql', 'pglite'))
  .find(path => existsSync(resolve(path, 'dist/index.js')))
if (!root) throw new Error('Run through npm exec with @electric-sql/pglite@0.5.8.')
const { PGlite } = await import(pathToFileURL(resolve(root, 'dist/index.js')).href)
const db = new PGlite()
try {
  await db.exec(`
    create schema auth; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create role anon; create role authenticated; create role service_role;
    create table organizations(id uuid primary key);
    create table organization_members(organization_id uuid, user_id uuid, status text, role text);
    create table customers(id uuid primary key, organization_id uuid, profile_id uuid);
    create table products(id uuid primary key, organization_id uuid, has_variants boolean default false, is_active boolean default true, stock_quantity integer default 0, updated_at timestamptz);
    create table product_variants(id uuid primary key, product_id uuid references products(id), organization_id uuid, variant_name text, is_active boolean default true, stock_quantity integer default 0, updated_at timestamptz);
    create table branch_inventory(branch_id uuid, product_id uuid, stock_quantity integer, updated_at timestamptz);
    create table promotions(id uuid primary key, organization_id uuid, is_active boolean, usage_count integer default 0, usage_limit integer, updated_at timestamptz);
    create table customer_orders(
      id uuid primary key default gen_random_uuid(), organization_id uuid references organizations(id), customer_id uuid,
      order_number text, status text, payment_status text, payment_method text, fulfillment_type text,
      branch_id uuid,
      total numeric(12,2), store_credit_reserved numeric(14,2) default 0, store_credit_applied numeric(14,2) default 0,
      stock_reserved boolean default true, delivered_at timestamptz, cancelled_at timestamptz, updated_at timestamptz default now()
    );
    create table customer_order_status_history(id uuid default gen_random_uuid(), organization_id uuid, order_id uuid, from_status text, to_status text, note text, changed_by uuid, created_at timestamptz default now());
    create table customer_order_items(id uuid default gen_random_uuid(), organization_id uuid, order_id uuid, product_id uuid, product_name text, product_sku text, quantity integer, unit_price numeric, subtotal numeric);
    create table customer_order_payment_history(id uuid default gen_random_uuid(), organization_id uuid, order_id uuid, from_status text, to_status text, payment_method text, amount numeric, note text, changed_by uuid, created_at timestamptz);
    create table customer_store_credit_reservations(id uuid default gen_random_uuid(), organization_id uuid, order_id uuid, amount numeric, status text, released_at timestamptz, updated_at timestamptz);
    create table customer_store_credits(id uuid default gen_random_uuid(), organization_id uuid, customer_id uuid, amount numeric, reason text, source_type text, source_id uuid, created_by uuid);
    alter table customer_store_credits add constraint customer_store_credits_source_type_check check(source_type in ('after_sales','sale','repair','order','manual'));
    create function create_public_order_with_store_credit_atomic(uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,text,text,text,numeric) returns jsonb language sql as $$ select jsonb_build_object('order_id', gen_random_uuid(), 'customer_id', $2) $$;
  `)
  const migration = readFileSync(resolve('supabase/migrations/20260903223832_harden_customer_order_lifecycle.sql'), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  const collectionsMigration = readFileSync(resolve('supabase/migrations/20260903232904_record_customer_order_collections.sql'), 'utf8')
  await db.exec(collectionsMigration)
  await db.exec(collectionsMigration)
  const variantsMigration = readFileSync(resolve('supabase/migrations/20260903235322_public_order_variant_inventory.sql'), 'utf8')
  await db.exec(variantsMigration)
  await db.exec(variantsMigration)
  const org = '00000000-0000-4000-8000-000000000001'
  const actor = '00000000-0000-4000-8000-000000000002'
  const customer = '00000000-0000-4000-8000-000000000003'
  const order = '00000000-0000-4000-8000-000000000004'
  await db.query('insert into organizations values ($1)', [org])
  await db.query("insert into organization_members values ($1,$2,'active','owner')", [org, actor])
  await db.query('insert into customers values ($1,$2,$3)', [customer, org, actor])
  await db.query("insert into customer_orders(id,organization_id,customer_id,order_number,status,payment_status,payment_method,fulfillment_type,total,store_credit_applied) values($1,$2,$3,'PED-1','READY','PENDING','CASH','PICKUP',100000,10000)", [order, org, customer])
  await db.query("select advance_customer_order_status_atomic($1,$2,$3,'DELIVERED',null)", [org, order, actor])
  await db.query("select record_customer_order_payment_atomic($1,$2,$3,'PAID',null)", [org, order, actor])
  await db.query("select record_customer_order_payment_atomic($1,$2,$3,'PAID',null)", [org, order, actor])
  assert.equal((await db.query('select count(*)::int count from customer_order_payment_history')).rows[0].count, 1)
  await db.query("update customer_orders set status='CANCELLED' where id=$1", [order])
  assert.equal(Number((await db.query("select amount from customer_store_credits where source_type='order_refund'")).rows[0].amount), 10000)
  const collectionOrder = '00000000-0000-4000-8000-000000000005'
  const attemptOne = '00000000-0000-4000-8000-000000000006'
  const attemptTwo = '00000000-0000-4000-8000-000000000007'
  await db.query("insert into customer_orders(id,organization_id,customer_id,order_number,status,payment_status,payment_method,fulfillment_type,total) values($1,$2,$3,'PED-2','CONFIRMED','PENDING','CASH','PICKUP',50000)", [collectionOrder, org, customer])
  await db.query("select record_customer_order_collection_atomic($1,$2,$3,20000,'CASH',null,'Entrega inicial',$4)", [org, collectionOrder, actor, attemptOne])
  await db.query("select record_customer_order_collection_atomic($1,$2,$3,20000,'CASH',null,'Reintento',$4)", [org, collectionOrder, actor, attemptOne])
  await db.query("select record_customer_order_collection_atomic($1,$2,$3,30000,'TRANSFER','TRX-123',null,$4)", [org, collectionOrder, actor, attemptTwo])
  const collected = (await db.query('select collected_amount, payment_status from customer_orders where id=$1', [collectionOrder])).rows[0]
  assert.equal(Number(collected.collected_amount), 50000)
  assert.equal(collected.payment_status, 'PAID')
  assert.equal((await db.query('select count(*)::int count from customer_order_payment_history where order_id=$1', [collectionOrder])).rows[0].count, 2)
  const variantProduct = '00000000-0000-4000-8000-000000000008'
  const variant = '00000000-0000-4000-8000-000000000009'
  const variantOrder = '00000000-0000-4000-8000-000000000010'
  await db.query('insert into products(id,organization_id,has_variants,stock_quantity) values($1,$2,true,0)', [variantProduct, org])
  await db.query("insert into product_variants(id,product_id,organization_id,variant_name,stock_quantity) values($1,$2,$3,'M / Negro',5)", [variant, variantProduct, org])
  await db.query("insert into customer_orders(id,organization_id,customer_id,order_number,status,payment_status,payment_method,fulfillment_type,total,stock_reserved) values($1,$2,$3,'PED-3','CONFIRMED','PENDING','CASH','PICKUP',100000,true)", [variantOrder, org, customer])
  await db.query("insert into customer_order_items(organization_id,order_id,product_id,variant_id,variant_name,product_name,quantity,unit_price,subtotal) values($1,$2,$3,$4,'M / Negro','Remera',2,50000,100000)", [org, variantOrder, variantProduct, variant])
  await db.query('select cancel_customer_order_atomic($1,$2,$3,null)', [org, variantOrder, actor])
  assert.equal(Number((await db.query('select stock_quantity from product_variants where id=$1', [variant])).rows[0].stock_quantity), 7)
  console.log('PASS: order lifecycle SQL syntax, repeatability, pickup flow, collection idempotency, partial/full payment, variant stock restoration and credit refund.')
} finally { await db.close() }
