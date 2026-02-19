-- Fix RLS policy for products table to restrict insert access
-- The existing policy "Authenticated users can insert products" is too permissive.
-- We will replace it with a policy that only allows users with specific roles (admin, manager, etc.) to insert products.

BEGIN;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;

-- Create a new, restrictive policy
-- Only allow inserts if the user has an appropriate role
CREATE POLICY "Authenticated users can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager', 'technician') -- Adjust roles as needed based on business logic
  )
);

COMMIT;
