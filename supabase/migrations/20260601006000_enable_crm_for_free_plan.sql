-- Customers are a core POS dependency, so the FREE plan must include CRM basics.

update public.plans
set modules = array['inventory','pos','crm']
where code = 'FREE';
