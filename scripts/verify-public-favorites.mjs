import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select current_setting('app.user_id', true)::uuid $$;
grant usage on schema auth to authenticated;
insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');`)
await db.exec(readFileSync('supabase/migrations/20260902215636_public_product_favorites.sql', 'utf8'))
await db.exec(`set role authenticated; set app.user_id = '00000000-0000-4000-8000-000000000001';
insert into public_product_favorites(user_id, product_id, store_slug, product_name, store_name) values (auth.uid(), '00000000-0000-4000-8000-000000000003', 'tienda', 'Producto', 'Tienda');`)
assert.equal((await db.query('select * from public_product_favorites')).rows.length, 1)
await assert.rejects(db.exec(`update public_product_favorites set user_id = '00000000-0000-4000-8000-000000000002'`))
await db.exec(`set app.user_id = '00000000-0000-4000-8000-000000000002'`)
assert.equal((await db.query('select * from public_product_favorites')).rows.length, 0)
await db.exec('delete from public_product_favorites')
await db.exec(`set app.user_id = '00000000-0000-4000-8000-000000000001'`)
assert.equal((await db.query('select * from public_product_favorites')).rows.length, 1)
await db.exec('reset role; set role anon')
await assert.rejects(db.query('select * from public_product_favorites'))
await db.close()
console.log('PASS: owner access, cross-account read/delete isolation, reassignment rejection, anonymous access denied')
