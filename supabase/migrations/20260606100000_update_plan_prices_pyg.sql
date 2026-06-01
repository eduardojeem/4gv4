-- Update subscription_plans prices from USD to PYG (Guaraní)
-- Basic: 70.000 PYG, Pro: 150.000 PYG, Enterprise: 300.000 PYG

update public.subscription_plans
set price = 70000, price_note = 'por mes', updated_at = now()
where tier = 'basic';

update public.subscription_plans
set price = 150000, price_note = 'por mes', updated_at = now()
where tier = 'pro';

update public.subscription_plans
set price = 300000, price_note = 'por mes', updated_at = now()
where tier = 'enterprise';

-- Free stays at 0
update public.subscription_plans
set price_note = 'Siempre gratis', updated_at = now()
where tier = 'free';
