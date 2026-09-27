alter table public.customers
  add column if not exists company_name text;

comment on column public.customers.company_name is
  'Empresa o razón social opcional asociada al responsable de una cuenta mayorista.';
