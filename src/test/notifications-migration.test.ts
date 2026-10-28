// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20261028120000_mobile_notifications_schema.sql')
const migrationSql = readFileSync(migrationPath, 'utf8')

describe('Notifications Phase 1 - Migration DDL and RLS Static Validation', () => {
  it('follows the 14-digit version naming convention in supabase/migrations', () => {
    const filename = '20261028120000_mobile_notifications_schema.sql'
    expect(/^\d{14}_[a-z0-9_]+\.sql$/.test(filename)).toBe(true)

    // Check that it is detected in the migrations folder without version collision
    const files = readdirSync(resolve(process.cwd(), 'supabase/migrations')).filter((name) => name !== '.gitkeep')
    const versions = files.map((name) => name.slice(0, 14))
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('creates the push_devices table with multi-tenant organization_id and unique constraint', () => {
    expect(migrationSql).toContain('create table if not exists public.push_devices')
    expect(migrationSql).toContain('organization_id uuid not null references public.organizations(id) on delete cascade')
    expect(migrationSql).toContain('user_id uuid not null references auth.users(id) on delete cascade')
    expect(migrationSql).toContain('push_token text not null')
    expect(migrationSql).toContain('platform text not null check (platform in (\'ios\', \'android\', \'web\'))')
    expect(migrationSql).toContain('constraint push_devices_user_org_device_key unique (user_id, organization_id, device_id)')
    expect(migrationSql).toContain('create index if not exists push_devices_user_org_idx on public.push_devices (user_id, organization_id)')
    expect(migrationSql).toContain('create index if not exists push_devices_token_idx on public.push_devices (push_token)')
  })

  it('creates the notification_preferences table with composite unique constraint', () => {
    expect(migrationSql).toContain('create table if not exists public.notification_preferences')
    expect(migrationSql).toContain('organization_id uuid not null references public.organizations(id) on delete cascade')
    expect(migrationSql).toContain('user_id uuid not null references auth.users(id) on delete cascade')
    expect(migrationSql).toContain('notification_type text not null')
    expect(migrationSql).toContain('push_enabled boolean not null default true')
    expect(migrationSql).toContain('in_app_enabled boolean not null default true')
    expect(migrationSql).toContain('constraint notification_preferences_org_user_type_key unique (organization_id, user_id, notification_type)')
    expect(migrationSql).toContain('create index if not exists notif_prefs_org_user_idx on public.notification_preferences (organization_id, user_id)')
  })

  it('creates the notifications table with tenant-safe composite branch FK and feed index', () => {
    expect(migrationSql).toContain('create table if not exists public.notifications')
    expect(migrationSql).toContain('organization_id uuid not null references public.organizations(id) on delete cascade')
    expect(migrationSql).toContain('branch_id uuid')
    expect(migrationSql).toContain('constraint notifications_branch_scope_fkey foreign key (organization_id, branch_id)')
    expect(migrationSql).toContain('references public.branches(organization_id, id) on delete set null (branch_id)')
    expect(migrationSql).toContain('user_id uuid not null references auth.users(id) on delete cascade')
    expect(migrationSql).toContain('type text not null')
    expect(migrationSql).toContain('title text not null')
    expect(migrationSql).toContain('body text not null')
    expect(migrationSql).toContain('data jsonb not null default \'{}\'::jsonb')
    expect(migrationSql).toContain('read_at timestamptz')
    expect(migrationSql).toContain('idempotency_key text')

    // Verification of feed, unread and chronological indices
    expect(migrationSql).toContain('create index if not exists notifications_user_org_read_idx on public.notifications (user_id, organization_id, read_at)')
    expect(migrationSql).toContain('create index if not exists notifications_user_org_feed_idx on public.notifications (user_id, organization_id, created_at desc)')
    expect(migrationSql).toContain('create index if not exists notifications_org_created_idx on public.notifications (organization_id, created_at desc)')
    expect(migrationSql).toMatch(
      /create unique index if not exists notifications_idempotency_idx\s+on public\.notifications\s*\(organization_id,\s*user_id,\s*idempotency_key\)\s+where idempotency_key is not null/i,
    )
  })

  it('enables RLS on all three tables', () => {
    expect(migrationSql).toContain('alter table public.push_devices enable row level security;')
    expect(migrationSql).toContain('alter table public.notification_preferences enable row level security;')
    expect(migrationSql).toContain('alter table public.notifications enable row level security;')
  })

  it('enforces active organization membership verification in RLS policies', () => {
    expect(migrationSql).toMatch(
      /om\.user_id = auth\.uid\(\)\s+and om\.organization_id = push_devices\.organization_id\s+and om\.status = 'active'/,
    )
    expect(migrationSql).toMatch(
      /om\.user_id = auth\.uid\(\)\s+and om\.organization_id = notification_preferences\.organization_id\s+and om\.status = 'active'/,
    )
    expect(migrationSql).toMatch(
      /om\.user_id = auth\.uid\(\)\s+and om\.organization_id = notifications\.organization_id\s+and om\.status = 'active'/,
    )
  })

  it('attaches canonical update_updated_at_column triggers to push_devices and notification_preferences', () => {
    expect(migrationSql).toContain('create trigger update_push_devices_updated_at')
    expect(migrationSql).toContain('before update on public.push_devices')
    expect(migrationSql).toContain('execute function public.update_updated_at_column();')

    expect(migrationSql).toContain('create trigger update_notification_preferences_updated_at')
    expect(migrationSql).toContain('before update on public.notification_preferences')
    expect(migrationSql).toContain('execute function public.update_updated_at_column();')
  })

  it('restricts authenticated mutation permissions to read_at only', () => {
    expect(migrationSql).toContain('revoke all on table public.notifications from authenticated;')
    expect(migrationSql).toContain('grant select on table public.notifications to authenticated;')
    expect(migrationSql).toContain('grant update (read_at) on table public.notifications to authenticated;')
    expect(migrationSql).not.toContain('grant update on table public.notifications to authenticated;')
    expect(migrationSql).not.toContain('grant insert on table public.notifications to authenticated;')
    expect(migrationSql).not.toContain('grant delete on table public.notifications from authenticated;')
  })

  it('strictly revokes anonymous and public access to all notification tables', () => {
    expect(migrationSql).toContain('revoke all on table public.push_devices from anon, public;')
    expect(migrationSql).toContain('revoke all on table public.notification_preferences from anon, public;')
    expect(migrationSql).toContain('revoke all on table public.notifications from anon, public;')
  })
})

describe('Notifications Phase 1 - In-Database DDL & Security Execution (PGlite)', () => {
  let db: PGlite

  async function setupTestDb() {
    db = new PGlite()

    // 1. Setup prerequisite schemas, roles and tables
    await db.exec(`
      create schema if not exists auth;
      create table if not exists auth.users (
        id uuid primary key default gen_random_uuid(),
        email text
      );

      create or replace function auth.uid() returns uuid as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ language sql stable;

      create table if not exists public.organizations (
        id uuid primary key default gen_random_uuid(),
        name text not null
      );

      create table if not exists public.branches (
        id uuid not null default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        name text not null,
        primary key (organization_id, id)
      );

      create table if not exists public.organization_members (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        user_id uuid not null references auth.users(id) on delete cascade,
        role text not null default 'member',
        status text not null default 'active',
        unique (organization_id, user_id)
      );

      create or replace function public.update_updated_at_column()
      returns trigger as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$ language plpgsql;

      -- Create roles if not exist
      do $$
      begin
        if not exists (select from pg_roles where rolname = 'authenticated') then
          create role authenticated;
        end if;
        if not exists (select from pg_roles where rolname = 'anon') then
          create role anon;
        end if;
        if not exists (select from pg_roles where rolname = 'service_role') then
          create role service_role;
        end if;
      end
      $$;

      grant usage on schema public to authenticated, anon, service_role;
      grant usage on schema auth to authenticated, anon, service_role;
      grant select on table auth.users, public.organizations, public.branches, public.organization_members to authenticated;
    `)

    // 2. Apply migration SQL
    await db.exec(migrationSql)

    return db
  }

  // Ensure DB instance is closed after each test to release event loop / WASM
  afterEach(async () => {
    if (db) {
      await db.close()
    }
  })

  it('enforces composite branch tenant integrity with ON DELETE SET NULL (branch_id)', async () => {
    const db = await setupTestDb()

    const orgA = '11111111-1111-1111-1111-111111111111'
    const orgB = '22222222-2222-2222-2222-222222222222'
    const userA = '33333333-3333-3333-3333-333333333333'
    const branchA = '44444444-4444-4444-4444-444444444444'
    const branchB = '55555555-5555-5555-5555-555555555555'

    await db.query(`insert into auth.users (id) values ($1)`, [userA])
    await db.query(`insert into public.organizations (id, name) values ($1, 'Org A'), ($2, 'Org B')`, [orgA, orgB])
    await db.query(`insert into public.branches (id, organization_id, name) values ($1, $2, 'Branch A'), ($3, $4, 'Branch B')`, [
      branchA,
      orgA,
      branchB,
      orgB,
    ])

    // 1. Accepted: Org A + Branch A
    const notifA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    await db.query(
      `insert into public.notifications (id, organization_id, branch_id, user_id, type, title, body)
       values ($1, $2, $3, $4, 'SALE_CREATED', 'Venta', 'Test')`,
      [notifA, orgA, branchA, userA],
    )

    // 2. Rejected: Org A + Branch B (cross-tenant branch reference)
    const notifCross = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    await expect(
      db.query(
        `insert into public.notifications (id, organization_id, branch_id, user_id, type, title, body)
         values ($1, $2, $3, $4, 'SALE_CREATED', 'Venta', 'Cross')`,
        [notifCross, orgA, branchB, userA],
      ),
    ).rejects.toThrow()

    // 3. Accepted: Org A + NULL branch
    const notifNullBranch = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    await db.query(
      `insert into public.notifications (id, organization_id, branch_id, user_id, type, title, body)
       values ($1, $2, null, $3, 'SALE_CREATED', 'Venta', 'No branch')`,
      [notifNullBranch, orgA, userA],
    )

    // 4. ON DELETE SET NULL test: Deleting Branch A sets branch_id to NULL, keeping organization_id and notification row intact
    await db.query(`delete from public.branches where id = $1 and organization_id = $2`, [branchA, orgA])
    const result = await db.query<{ branch_id: string | null; organization_id: string }>(
      `select branch_id, organization_id from public.notifications where id = $1`,
      [notifA],
    )
    expect(result.rows[0].branch_id).toBeNull()
    expect(result.rows[0].organization_id).toBe(orgA)
  })

  it('triggers update_updated_at_column automatically on update', async () => {
    const db = await setupTestDb()

    const orgId = '11111111-1111-1111-1111-111111111111'
    const userId = '33333333-3333-3333-3333-333333333333'
    await db.query(`insert into auth.users (id) values ($1)`, [userId])
    await db.query(`insert into public.organizations (id, name) values ($1, 'Org Test')`, [orgId])

    // Test push_devices trigger
    await db.query(
      `insert into public.push_devices (id, user_id, organization_id, device_id, platform, push_token, updated_at)
       values ('dddddddd-dddd-dddd-dddd-dddddddddddd', $1, $2, 'dev-1', 'android', 'token-1', '2020-01-01 00:00:00Z')`,
      [userId, orgId],
    )
    await db.query(`update public.push_devices set app_version = '2.0.0' where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'`)
    const devRes = await db.query<{ updated_at: string }>(
      `select updated_at from public.push_devices where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'`,
    )
    expect(new Date(devRes.rows[0].updated_at).getFullYear()).toBeGreaterThan(2020)

    // Test notification_preferences trigger
    await db.query(
      `insert into public.notification_preferences (id, user_id, organization_id, notification_type, push_enabled, updated_at)
       values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', $1, $2, 'SALE_CREATED', true, '2020-01-01 00:00:00Z')`,
      [userId, orgId],
    )
    await db.query(`update public.notification_preferences set push_enabled = false where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'`)
    const prefRes = await db.query<{ updated_at: string }>(
      `select updated_at from public.notification_preferences where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'`,
    )
    expect(new Date(prefRes.rows[0].updated_at).getFullYear()).toBeGreaterThan(2020)
  })

  it('enforces column-level UPDATE security for authenticated role (only read_at allowed)', async () => {
    const db = await setupTestDb()

    const orgId = '11111111-1111-1111-1111-111111111111'
    const userA = '33333333-3333-3333-3333-333333333333'
    const notifId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

    await db.query(`insert into auth.users (id) values ($1)`, [userA])
    await db.query(`insert into public.organizations (id, name) values ($1, 'Org A')`, [orgId])
    await db.query(`insert into public.organization_members (organization_id, user_id, status) values ($1, $2, 'active')`, [
      orgId,
      userA,
    ])

    // Insert notification via service_role
    await db.query(
      `insert into public.notifications (id, organization_id, user_id, type, title, body, data)
       values ($1, $2, $3, 'SALE_CREATED', 'Venta Original', 'Cuerpo Original', '{"amount": 1000}'::jsonb)`,
      [notifId, orgId, userA],
    )

    // Switch session to authenticated userA
    await db.exec(`
      set role authenticated;
      set request.jwt.claim.sub = '${userA}';
    `)

    // 1. UPDATE read_at is ALLOWED on own notification
    await db.query(`update public.notifications set read_at = now() where id = $1`, [notifId])
    const readCheck = await db.query<{ read_at: string | null }>(`select read_at from public.notifications where id = $1`, [
      notifId,
    ])
    expect(readCheck.rows.length).toBe(1)
    expect(readCheck.rows[0].read_at).not.toBeNull()

    // 2. UPDATE title is REJECTED (permission denied for table notifications)
    await expect(
      db.query(`update public.notifications set title = 'Hacked' where id = $1`, [notifId]),
    ).rejects.toThrow(/permission denied/i)

    // 3. UPDATE body is REJECTED
    await expect(
      db.query(`update public.notifications set body = 'Hacked' where id = $1`, [notifId]),
    ).rejects.toThrow(/permission denied/i)

    // 4. UPDATE data is REJECTED
    await expect(
      db.query(`update public.notifications set data = '{"amount": 0}'::jsonb where id = $1`, [notifId]),
    ).rejects.toThrow(/permission denied/i)

    // 5. UPDATE organization_id is REJECTED
    await expect(
      db.query(`update public.notifications set organization_id = '22222222-2222-2222-2222-222222222222' where id = $1`, [
        notifId,
      ]),
    ).rejects.toThrow(/permission denied/i)

    // 6. UPDATE user_id is REJECTED
    await expect(
      db.query(`update public.notifications set user_id = '22222222-2222-2222-2222-222222222222' where id = $1`, [notifId]),
    ).rejects.toThrow(/permission denied/i)

    // 7. INSERT as authenticated is REJECTED
    await expect(
      db.query(
        `insert into public.notifications (organization_id, user_id, type, title, body)
         values ($1, $2, 'SALE_CREATED', 'Fake', 'Fake')`,
        [orgId, userA],
      ),
    ).rejects.toThrow(/permission denied/i)

    // 8. DELETE as authenticated is REJECTED
    await expect(
      db.query(`delete from public.notifications where id = $1`, [notifId]),
    ).rejects.toThrow(/permission denied/i)

    // Reset role
    await db.exec(`reset role;`)
  })

  it('enforces multi-tenant RLS isolation for SELECT operations', async () => {
    const db = await setupTestDb()

    const orgA = '11111111-1111-1111-1111-111111111111'
    const orgB = '22222222-2222-2222-2222-222222222222'
    const userA = '33333333-3333-3333-3333-333333333333'
    const userB = '44444444-4444-4444-4444-444444444444'

    const notifUserA_OrgA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const notifUserB_OrgA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const notifUserA_OrgB = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

    await db.query(`insert into auth.users (id) values ($1), ($2)`, [userA, userB])
    await db.query(`insert into public.organizations (id, name) values ($1, 'Org A'), ($2, 'Org B')`, [orgA, orgB])
    await db.query(
      `insert into public.organization_members (organization_id, user_id, status) values ($1, $2, 'active'), ($1, $3, 'active')`,
      [orgA, userA, userB],
    )

    // Insert notifications as service_role
    await db.query(
      `insert into public.notifications (id, organization_id, user_id, type, title, body) values
       ($1, $2, $3, 'SALE_CREATED', 'Notif UserA OrgA', 'Body'),
       ($4, $2, $5, 'SALE_CREATED', 'Notif UserB OrgA', 'Body'),
       ($6, $7, $3, 'SALE_CREATED', 'Notif UserA OrgB', 'Body')`,
      [notifUserA_OrgA, orgA, userA, notifUserB_OrgA, userB, notifUserA_OrgB, orgB],
    )

    // Switch session to userA
    await db.exec(`
      set role authenticated;
      set request.jwt.claim.sub = '${userA}';
    `)

    // 1. SELECT own notification inside member org -> returned
    const ownRes = await db.query(`select id from public.notifications where id = $1`, [notifUserA_OrgA])
    expect(ownRes.rows.length).toBe(1)
    expect(ownRes.rows[0].id).toBe(notifUserA_OrgA)

    // 2. SELECT notification from another user inside same org -> denied / empty
    const otherUserRes = await db.query(`select id from public.notifications where id = $1`, [notifUserB_OrgA])
    expect(otherUserRes.rows.length).toBe(0)

    // 3. SELECT notification from another org (where not a member) -> denied / empty
    const otherOrgRes = await db.query(`select id from public.notifications where id = $1`, [notifUserA_OrgB])
    expect(otherOrgRes.rows.length).toBe(0)

    // 4. SELECT notification after membership becomes inactive -> denied / empty
    await db.exec(`reset role;`)
    await db.query(`update public.organization_members set status = 'inactive' where organization_id = $1 and user_id = $2`, [
      orgA,
      userA,
    ])
    await db.exec(`
      set role authenticated;
      set request.jwt.claim.sub = '${userA}';
    `)
    const inactiveRes = await db.query(`select id from public.notifications where id = $1`, [notifUserA_OrgA])
    expect(inactiveRes.rows.length).toBe(0)

    await db.exec(`reset role;`)
  })
})
