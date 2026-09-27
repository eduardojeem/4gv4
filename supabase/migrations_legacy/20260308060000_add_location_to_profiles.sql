-- Add location column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Remove 'name' usage if it was intended to be a column, but we use full_name
-- No DDL needed for removing 'name' from code, but just ensuring schema is correct.
