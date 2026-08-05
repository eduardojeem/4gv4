-- Migration to add 'services' limits to subscription plans
UPDATE subscription_plans
SET limits = jsonb_set(limits, '{services}', '50')
WHERE tier = 'FREE';

UPDATE subscription_plans
SET limits = jsonb_set(limits, '{services}', '200')
WHERE tier = 'BASIC';

UPDATE subscription_plans
SET limits = jsonb_set(limits, '{services}', '5000')
WHERE tier = 'PRO';

UPDATE subscription_plans
SET limits = jsonb_set(limits, '{services}', 'null')
WHERE tier = 'ENTERPRISE';

-- As triggers might not automatically update the 'plans' table for this specific operation in some environments,
-- we also explicitly update the 'plans' table to ensure limits are applied immediately without relying on the trigger.
UPDATE plans
SET limits = jsonb_set(limits, '{services}', '50')
WHERE code = 'FREE';

UPDATE plans
SET limits = jsonb_set(limits, '{services}', '200')
WHERE code = 'BASIC';

UPDATE plans
SET limits = jsonb_set(limits, '{services}', '5000')
WHERE code = 'PRO';

UPDATE plans
SET limits = jsonb_set(limits, '{services}', 'null')
WHERE code = 'ENTERPRISE';
