// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('atomic service proposal SQL', () => {
  it('rejects stale proposals and rolls back all settings when audit fails', async () => {
    const db = new PGlite()
    const org = '00000000-0000-0000-0000-000000000001'
    const actor = '00000000-0000-0000-0000-000000000002'
    try {
      await db.exec(`create role service_role; create role anon; create role authenticated;
        create table organizations(id uuid primary key, plan text);
        create table plans(id int);
        create table subscriptions(organization_id uuid);
        create table organization_module_trials(organization_id uuid);
        create table website_settings(organization_id uuid, key text, value jsonb, updated_by uuid, updated_at timestamptz, primary key(organization_id,key));
        create table tenant_audit_log(organization_id uuid,user_id uuid,action text,resource text,resource_id text,metadata jsonb);
        insert into organizations values('${org}','PRO');
        insert into website_settings values('${org}','company_info','{"name":"Original"}',null,now());`)
      await db.exec(readFileSync('supabase/migrations/20261014120006_apply_service_website_proposal.sql', 'utf8'))
      const getRevision = async () => {
        const result = await db.query<{ revision: string }>('select public.service_website_proposal_revision($1) as revision', [org])
        return result.rows[0].revision
      }
      const revision = await getRevision()
      await db.query('select public.apply_service_website_proposal($1,$2,$3,$4::jsonb)', [org, actor, revision, JSON.stringify({ company_info: { name: 'New' } })])
      await expect(db.query('select public.apply_service_website_proposal($1,$2,$3,$4::jsonb)', [org, actor, revision, '{}'])).rejects.toThrow('PROPOSAL_STALE')
      const updated = await getRevision()
      await expect(db.query('select public.apply_service_website_proposal($1,$2,$3,$4::jsonb)', [org, actor, updated, '{}'])).rejects.toThrow('INVALID_PROPOSAL_KEYS')
      // Publishing unchanged values must consume the revision as well.
      await db.query('select public.apply_service_website_proposal($1,$2,$3,$4::jsonb)', [org, actor, updated, '{"company_info":{"name":"New"}}'])
      const republished = await getRevision()
      expect(republished).not.toBe(updated)
      await expect(db.query('select public.apply_service_website_proposal($1,$2,$3,$4::jsonb)', [org, actor, republished, '{"checkout":{}}'])).rejects.toThrow('INVALID_PROPOSAL_KEYS')
      await db.exec(`alter table tenant_audit_log add constraint reject_audit check(false) not valid;`)
      await expect(db.query('select public.apply_service_website_proposal($1,$2,$3,$4::jsonb)', [org, actor, republished, '{"company_info":{"name":"Wrong"}}'])).rejects.toThrow()
      expect((await db.query<{ value: unknown }>('select value from website_settings where key=\'company_info\'')).rows[0].value).toEqual({ name: 'New' })
      expect(await getRevision()).toBe(republished)
      // Existing editors are part of the revision, not just this RPC.
      await db.exec(`update website_settings set value='{"name":"Editor"}' where key='company_info'`)
      await expect(db.query('select public.apply_service_website_proposal($1,$2,$3,$4::jsonb)', [org, actor, updated, '{}'])).rejects.toThrow('PROPOSAL_STALE')
      const privileges = await db.query<{ allowed: boolean }>(`select has_function_privilege('anon','public.apply_service_website_proposal(uuid,uuid,text,jsonb)','execute') as allowed`)
      expect(privileges.rows[0].allowed).toBe(false)
    } finally { await db.close() }
  }, 30000)
})
