-- Fix RLS policy for products table to restrict update access
-- The existing policy "Authenticated users can update products" is too permissive.
-- We will replace it with a policy that only allows users with specific roles (admin, manager, etc.) to update products.

BEGIN;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;

-- Create a new, restrictive policy
-- Only allow updates if the user has an appropriate role
CREATE POLICY "Authenticated users can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager', 'technician') -- Adjust roles as needed based on business logic
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager', 'technician') -- Adjust roles as needed based on business logic
  )
);

COMMIT;
