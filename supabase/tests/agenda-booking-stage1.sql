-- Run against an isolated local database AFTER all stage-1 migrations.
-- Never run fixtures against the linked production project.
begin;
select plan(11);
select has_column('public', 'agenda_settings', 'professional_selection');
select col_default_is('public', 'agenda_settings', 'professional_selection', 'optional');
select col_default_is('public', 'agenda_professionals', 'online_visible', 'true');
select col_is_null('public', 'agenda_professionals', 'opening_hours');
select col_default_is('public', 'agenda_services', 'buffer_minutes', '0');
select col_not_null('public', 'appointments', 'occupied_until');
select ok((select relrowsecurity from pg_class where oid = 'public.agenda_professional_service_rates'::regclass), 'rates have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.agenda_time_off'::regclass), 'time off has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.agenda_booking_quotes'::regclass), 'quotes have RLS');
select ok(not has_table_privilege('anon', 'public.agenda_booking_quotes', 'SELECT'), 'anonymous users cannot read quote prices');
select ok(not has_table_privilege('authenticated', 'public.agenda_booking_quotes', 'SELECT'), 'staff cannot bypass server quote filtering');
select * from finish();
rollback;
