# Suppliers RLS Security Fix

## Issue Description

The `suppliers` table had an overly permissive RLS (Row Level Security) policy named "Permitir todo en proveedores a usuarios autenticados" that used `USING (true)` and `WITH CHECK (true)` for ALL operations. This effectively bypassed row-level security for all authenticated users, allowing unrestricted access to supplier data.

## Security Risk

- **High Risk**: Any authenticated user could perform any operation (SELECT, INSERT, UPDATE, DELETE) on suppliers
- **Data Integrity**: No access control based on user roles
- **Audit Trail**: Difficult to track who made changes to supplier data
- **Compliance**: Violates principle of least privilege

## Solution Implemented

### New Role-Based Policies

1. **View Access (SELECT)**: All authenticated users can view suppliers
   - Justification: Suppliers are often needed in dropdowns and forms across the application

2. **Insert/Update Access**: Only `admin` and `vendedor` roles can create and modify suppliers
   - Justification: Only sales staff and administrators should manage supplier relationships

3. **Delete Access**: Only `admin` role can delete suppliers
   - Justification: Deletion is a critical operation that should be restricted to administrators

### Policy Details

```sql
-- View access for all authenticated users
CREATE POLICY "Authenticated users can view suppliers" 
ON public.suppliers FOR SELECT TO authenticated USING (true);

-- Insert access for admins and vendedores
CREATE POLICY "Admins and vendedores can insert suppliers" 
ON public.suppliers FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'vendedor')
    )
);

-- Update access for admins and vendedores
CREATE POLICY "Admins and vendedores can update suppliers" 
ON public.suppliers FOR UPDATE TO authenticated 
USING (...) WITH CHECK (...);

-- Delete access only for admins
CREATE POLICY "Only admins can delete suppliers" 
ON public.suppliers FOR DELETE TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
```

## Related Tables Fixed

The following related tables also had similar overly permissive policies that were fixed:

- `supplier_products`
- `purchase_orders`

## User Roles

The system recognizes these user roles (from `user_role` enum):
- `admin`: Full access to all operations
- `vendedor`: Can manage suppliers and related data
- `tecnico`: Can view suppliers but cannot modify
- `cliente`: Can view suppliers but cannot modify

## Migration Applied

- **File**: `supabase/migrations/20250108_fix_suppliers_rls_security.sql`
- **Verification**: `scripts/verify-suppliers-rls.sql`

## Testing

Run the verification script to ensure policies are working correctly:

```sql
\i scripts/verify-suppliers-rls.sql
```

## Impact Assessment

### Positive Impact
- ✅ Proper access control based on user roles
- ✅ Follows principle of least privilege
- ✅ Better audit trail and security
- ✅ Compliance with security best practices

### Potential Issues
- ⚠️ Users with `tecnico` or `cliente` roles can no longer modify suppliers
- ⚠️ Applications expecting unrestricted access may need updates
- ⚠️ Need to ensure all users have proper roles assigned

## Recommendations

1. **Audit User Roles**: Ensure all users have appropriate roles assigned in the `profiles` table
2. **Application Testing**: Test all supplier-related functionality with different user roles
3. **Monitor Logs**: Watch for permission denied errors after deployment
4. **Documentation**: Update API documentation to reflect new access restrictions

## Rollback Plan

If issues arise, the previous permissive policy can be temporarily restored:

```sql
-- Emergency rollback (NOT RECOMMENDED for production)
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins and vendedores can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins and vendedores can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Only admins can delete suppliers" ON public.suppliers;

CREATE POLICY "Temporary permissive policy" ON public.suppliers
FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

However, this should only be used as a temporary measure while fixing the underlying issues.