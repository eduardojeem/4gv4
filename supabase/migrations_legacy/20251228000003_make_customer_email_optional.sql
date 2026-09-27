-- Make email optional in customers table
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;

-- If there is a unique constraint on email, it usually allows multiple NULLs in Postgres.
-- However, if there was a unique index on (email) where email is not null, it will now allow nulls.
-- Let's check if we need to handle empty strings. 
-- Ideally we should convert existing placeholder emails or empty strings to NULL if we want to clean up, 
-- but for now let's just allow NULLs.
