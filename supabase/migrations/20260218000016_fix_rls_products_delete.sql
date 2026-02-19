-- Fix RLS policy for products table to restrict delete access
-- The existing policy "Authenticated users can delete products" is too permissive.
-- We will replace it with a policy that only allows users with specific roles (admin, manager) to delete products.

BEGIN;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

-- Create a new, restrictive policy
-- Only allow deletions if the user has an appropriate role
CREATE POLICY "Authenticated users can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager') -- Usually deletion is restricted to higher roles
  )
);

COMMIT;
