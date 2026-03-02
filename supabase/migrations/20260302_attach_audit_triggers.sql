-- Migration: Attach Audit Triggers to Sensitive Tables
-- Date: 2026-03-02
-- Description: Acts on tables that should be audited automatically.

-- 1. Function to safely attach trigger
CREATE OR REPLACE FUNCTION attach_audit_trigger(table_name TEXT) 
RETURNS void AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger_auto ON %I', table_name);
    EXECUTE format('CREATE TRIGGER audit_trigger_auto AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_function()', table_name);
END;
$$ LANGUAGE plpgsql;

-- 2. Attach triggers to core tables
SELECT attach_audit_trigger('profiles');
SELECT attach_audit_trigger('user_roles');
SELECT attach_audit_trigger('products');
SELECT attach_audit_trigger('categories');
SELECT attach_audit_trigger('suppliers');

-- 3. Cleanup
DROP FUNCTION attach_audit_trigger(TEXT);

-- 4. Verify existing triggers
SELECT 
    event_object_table as table_name, 
    trigger_name
FROM information_schema.triggers 
WHERE trigger_name = 'audit_trigger_auto'
ORDER BY table_name;
