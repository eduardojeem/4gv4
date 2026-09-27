-- Migration: seed_website_services_corporate
-- 2026-08-06: Removed predefined services.
-- Organizations now start with an empty catalog (services: []).
-- Admins build their own catalog from /admin/website → Servicios Públicos.
-- This migration intentionally does nothing to preserve existing custom catalogs.
BEGIN;
COMMIT;
