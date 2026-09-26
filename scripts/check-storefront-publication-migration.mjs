// Isolated PostgreSQL-WASM check. No environment secrets or remote connections.
// npm exec --yes --package=@electric-sql/pglite@0.5.8 -- node scripts/check-storefront-publication-migration.mjs
import { readFileSync, existsSync } from 'node:fs'
import { delimiter, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const packageRoot = (process.env.PATH ?? '').split(delimiter)
  .map(path => resolve(path, '..', '@electric-sql', 'pglite'))
  .find(path => existsSync(resolve(path, 'dist/index.js')))
if (!packageRoot) throw new Error('Run with the pinned npm exec command at the top of this file.')
const { PGlite } = await import(pathToFileURL(resolve(packageRoot, 'dist/index.js')).href)
const db = new PGlite()
const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const c = '00000000-0000-4000-8000-000000000003'
const user = '00000000-0000-4000-8000-000000000004'
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table organizations (id uuid primary key, name text, logo_url text, marketplace_public boolean default false, updated_at timestamptz);
    create table website_settings (organization_id uuid references organizations(id), key text, value jsonb, updated_by uuid, updated_at timestamptz, unique(organization_id,key));
    create table organization_members (organization_id uuid, user_id uuid, status text, role text);
    create table profiles (id uuid, role text, status text);
    create table organization_settings (organization_id uuid primary key, display_name text, currency text, timezone text, branding jsonb, modules jsonb, updated_at timestamptz);
    create table branches (id uuid default gen_random_uuid() primary key, organization_id uuid, code text, name text, slug text, address text, city text, phone text, email text, is_active boolean, is_default boolean, metadata jsonb, updated_at timestamptz, created_at timestamptz default now());
    create function has_org_permission(uuid,text) returns boolean language sql stable as $$ select coalesce(current_setting('test.organization_id', true), '') = $1::text $$;
    alter table website_settings enable row level security;
    create policy legacy_public_read on website_settings for select using (true);
    grant usage on schema public to anon, authenticated;
    grant select on organizations, website_settings to anon, authenticated;
    insert into organizations (id,name,marketplace_public) values ('${a}','Existing public',true), ('${b}','Existing private',false);
    insert into website_settings values ('${b}','checkout','{"commerceMode":"catalog"}',null,null);
  `)
  const migration = readFileSync(resolve('supabase/migrations/20260903033245_storefront_publication_opt_in.sql'), 'utf8')
  await db.exec(migration)
  assert.deepEqual((await db.query('select storefront_public from organizations order by id')).rows, [{ storefront_public: true }, { storefront_public: false }])
  assert.equal((await db.query('select value from website_settings where organization_id=$1 and key=$2', [a,'checkout'])).rows[0].value.commerceMode, 'cart')
  assert.equal((await db.query('select value from website_settings where organization_id=$1 and key=$2', [b,'checkout'])).rows[0].value.commerceMode, 'catalog')

  await db.query('insert into organizations (id,name) values ($1,$2)', [c, 'New store'])
  assert.deepEqual((await db.query('select storefront_public, marketplace_public from organizations where id=$1',[c])).rows[0], { storefront_public:false, marketplace_public:false })
  assert.equal((await db.query('select value from website_settings where organization_id=$1 and key=$2',[c,'checkout'])).rows[0].value.commerceMode, 'whatsapp')
  await db.query('insert into organization_members values ($1,$2,$3,$4)', [c,user,'active','owner'])
  await db.query('select complete_organization_onboarding($1,$2,$3,$4,$5,$6,$7,$8,$9)', [c,user,'New store','PYG','America/Asuncion','',{}, { address:'Street 123', city:'Asunción' }, { name:'New store', marketplacePublic:true, storefrontPublic:true }])
  assert.deepEqual((await db.query('select storefront_public, marketplace_public from organizations where id=$1',[c])).rows[0], { storefront_public:false, marketplace_public:false })
  assert.equal((await db.query('select value from website_settings where organization_id=$1 and key=$2',[c,'company_info'])).rows[0].value.storefrontPublic, false)
  await db.exec(migration)
  assert.equal((await db.query('select value from website_settings where organization_id=$1 and key=$2',[c,'checkout'])).rows[0].value.commerceMode, 'whatsapp')

  await db.exec('set role anon')
  assert.deepEqual((await db.query('select distinct organization_id from website_settings')).rows, [{organization_id:a}])
  await db.exec('reset role; set role authenticated')
  await db.query("select set_config('test.organization_id', $1, false)", [c])
  assert.equal((await db.query('select count(*)::int as count from website_settings where organization_id=$1',[c])).rows[0].count, 2)
  assert.equal((await db.query('select count(*)::int as count from website_settings where organization_id=$1',[b])).rows[0].count, 0)
  console.log('PASS: SQL syntax, legacy preservation, private registration, WhatsApp default, onboarding, repeat execution, anonymous and staff RLS.')
} finally {
  await db.close()
}
