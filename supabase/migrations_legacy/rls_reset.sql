do $$
declare r record;
begin
for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' loop
  execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
end loop;
end $$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin'));
$$;

create or replace function public.is_manager()
returns boolean language sql stable as $$
select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager'));
$$;

create or replace function public.is_cashier()
returns boolean language sql stable as $$
select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('cashier'));
$$;

create or replace function public.is_technician()
returns boolean language sql stable as $$
select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('technician'));
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
select public.is_admin() or public.is_manager() or public.is_cashier() or public.is_technician();
$$;

alter table if exists public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using ( id = auth.uid() or public.is_staff() );
create policy profiles_update_self on public.profiles for update to authenticated using ( id = auth.uid() ) with check ( id = auth.uid() );
create policy profiles_update_admin on public.profiles for update to authenticated using ( public.is_admin() ) with check ( public.is_admin() );

alter table if exists public.user_roles enable row level security;
create policy user_roles_read_self on public.user_roles for select to authenticated using ( user_id = auth.uid() or public.is_admin() );
create policy user_roles_manage_admin on public.user_roles for all to authenticated using ( public.is_admin() ) with check ( public.is_admin() );

alter table if exists public.user_permissions enable row level security;
create policy user_permissions_read_self on public.user_permissions for select to authenticated using ( user_id = auth.uid() or public.is_admin() );
create policy user_permissions_manage_admin on public.user_permissions for all to authenticated using ( public.is_admin() ) with check ( public.is_admin() );

alter table if exists public.categories enable row level security;
create policy categories_read_all on public.categories for select to authenticated using ( true );
create policy categories_write_admin_manager on public.categories for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.suppliers enable row level security;
create policy suppliers_read_all on public.suppliers for select to authenticated using ( true );
create policy suppliers_write_admin_manager on public.suppliers for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.products enable row level security;
create policy products_read_all on public.products for select to authenticated using ( true );
create policy products_insert_admin_manager on public.products for insert to authenticated with check ( public.is_manager() or public.is_admin() );
create policy products_update_admin_manager on public.products for update to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );
create policy products_delete_admin on public.products for delete to authenticated using ( public.is_admin() );

alter table if exists public.product_movements enable row level security;
create policy product_movements_read_staff on public.product_movements for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy product_movements_write_manager_admin on public.product_movements for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.product_price_history enable row level security;
create policy product_price_history_read_staff on public.product_price_history for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy product_price_history_write_manager_admin on public.product_price_history for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.product_alerts enable row level security;
create policy product_alerts_read_staff on public.product_alerts for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy product_alerts_write_manager_admin on public.product_alerts for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.customers enable row level security;
create policy customers_select_staff on public.customers for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy customers_manage_staff on public.customers for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.supplier_products enable row level security;
create policy supplier_products_read_staff on public.supplier_products for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy supplier_products_write_manager_admin on public.supplier_products for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.purchase_orders enable row level security;
create policy purchase_orders_read_staff on public.purchase_orders for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy purchase_orders_write_manager_admin on public.purchase_orders for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.purchase_order_items enable row level security;
create policy purchase_order_items_read_staff on public.purchase_order_items for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy purchase_order_items_write_manager_admin on public.purchase_order_items for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.inventory_reorders enable row level security;
create policy inventory_reorders_read_staff on public.inventory_reorders for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy inventory_reorders_write_manager_admin on public.inventory_reorders for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.promotions enable row level security;
create policy promotions_read_staff on public.promotions for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy promotions_write_manager_admin on public.promotions for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.sales enable row level security;
create policy sales_read_own_or_staff on public.sales for select to authenticated using ( created_by = auth.uid() or public.is_cashier() or public.is_manager() or public.is_admin() );
create policy sales_insert_staff on public.sales for insert to authenticated with check ( public.is_cashier() or public.is_manager() or public.is_admin() );
create policy sales_update_staff on public.sales for update to authenticated using ( public.is_cashier() or public.is_manager() or public.is_admin() ) with check ( public.is_cashier() or public.is_manager() or public.is_admin() );
create policy sales_delete_admin on public.sales for delete to authenticated using ( public.is_admin() );

alter table if exists public.sale_items enable row level security;
create policy sale_items_read_linked on public.sale_items for select to authenticated using ( exists ( select 1 from public.sales s where s.id = sale_items.sale_id and ( s.created_by = auth.uid() or public.is_cashier() or public.is_manager() or public.is_admin() ) ) );
create policy sale_items_write_staff on public.sale_items for all to authenticated using ( public.is_cashier() or public.is_manager() or public.is_admin() ) with check ( public.is_cashier() or public.is_manager() or public.is_admin() );

alter table if exists public.payments enable row level security;
create policy payments_read_staff on public.payments for select to authenticated using ( public.is_cashier() or public.is_manager() or public.is_admin() );
create policy payments_write_staff on public.payments for all to authenticated using ( public.is_cashier() or public.is_manager() or public.is_admin() ) with check ( public.is_cashier() or public.is_manager() or public.is_admin() );

alter table if exists public.cash_registers enable row level security;
create policy cash_registers_select_staff on public.cash_registers for select to authenticated using ( public.is_cashier() or public.is_manager() or public.is_admin() );
create policy cash_registers_manage_staff on public.cash_registers for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.cash_movements enable row level security;
create policy cash_movements_select_staff on public.cash_movements for select to authenticated using ( public.is_cashier() or public.is_manager() or public.is_admin() );
create policy cash_movements_write_staff on public.cash_movements for all to authenticated using ( public.is_cashier() or public.is_manager() or public.is_admin() ) with check ( public.is_cashier() or public.is_manager() or public.is_admin() );

alter table if exists public.customer_credits enable row level security;
create policy customer_credits_read_manager_admin on public.customer_credits for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy customer_credits_write_manager_admin on public.customer_credits for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.credit_installments enable row level security;
create policy credit_installments_read_manager_admin on public.credit_installments for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy credit_installments_write_manager_admin on public.credit_installments for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.credit_payments enable row level security;
create policy credit_payments_read_manager_admin on public.credit_payments for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy credit_payments_write_manager_admin on public.credit_payments for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.repairs enable row level security;
create policy repairs_select_staff_or_technician on public.repairs for select to authenticated using ( public.is_manager() or public.is_admin() or public.is_technician() );
create policy repairs_update_assigned_technician on public.repairs for update to authenticated using ( technician_id = auth.uid() or public.is_manager() or public.is_admin() ) with check ( technician_id = auth.uid() or public.is_manager() or public.is_admin() );
create policy repairs_insert_staff on public.repairs for insert to authenticated with check ( public.is_manager() or public.is_admin() or public.is_cashier() );

alter table if exists public.repair_status_history enable row level security;
create policy repair_status_history_read_staff on public.repair_status_history for select to authenticated using ( public.is_manager() or public.is_admin() or public.is_technician() );
create policy repair_status_history_write_staff on public.repair_status_history for all to authenticated using ( public.is_manager() or public.is_admin() or public.is_technician() ) with check ( public.is_manager() or public.is_admin() or public.is_technician() );

alter table if exists public.repair_notes enable row level security;
create policy repair_notes_select_staff on public.repair_notes for select to authenticated using ( public.is_manager() or public.is_admin() or public.is_technician() );
create policy repair_notes_write_authors_or_staff on public.repair_notes for all to authenticated using ( author_id = auth.uid() or public.is_technician() or public.is_manager() or public.is_admin() ) with check ( author_id = auth.uid() or public.is_technician() or public.is_manager() or public.is_admin() );

alter table if exists public.repair_parts enable row level security;
create policy repair_parts_read_staff on public.repair_parts for select to authenticated using ( public.is_manager() or public.is_admin() or public.is_technician() );
create policy repair_parts_write_staff on public.repair_parts for all to authenticated using ( public.is_manager() or public.is_admin() or public.is_technician() ) with check ( public.is_manager() or public.is_admin() or public.is_technician() );

alter table if exists public.repair_images enable row level security;
create policy repair_images_read_staff on public.repair_images for select to authenticated using ( public.is_manager() or public.is_admin() or public.is_technician() );
create policy repair_images_write_staff on public.repair_images for all to authenticated using ( public.is_manager() or public.is_admin() or public.is_technician() ) with check ( public.is_manager() or public.is_admin() or public.is_technician() );

alter table if exists public.audit_log enable row level security;
create policy audit_log_select_admin on public.audit_log for select to authenticated using ( public.is_admin() );

alter table if exists public.ai_insights enable row level security;
create policy ai_insights_read_manager_admin on public.ai_insights for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy ai_insights_write_manager_admin on public.ai_insights for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.automation_rules enable row level security;
create policy automation_rules_read_manager_admin on public.automation_rules for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy automation_rules_write_manager_admin on public.automation_rules for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.customer_segments enable row level security;
create policy customer_segments_read_manager_admin on public.customer_segments for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy customer_segments_write_manager_admin on public.customer_segments for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.segment_analytics enable row level security;
create policy segment_analytics_read_manager_admin on public.segment_analytics for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy segment_analytics_write_manager_admin on public.segment_analytics for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.segment_history enable row level security;
create policy segment_history_read_manager_admin on public.segment_history for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy segment_history_write_manager_admin on public.segment_history for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

alter table if exists public.posts enable row level security;
create policy posts_select_published_anon on public.posts for select to anon using ( status = 'published' );
create policy posts_select_auth on public.posts for select to authenticated using ( status = 'published' or user_id = auth.uid() or public.is_admin() );
create policy posts_crud_owner on public.posts for all to authenticated using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
create policy posts_manage_admin on public.posts for all to authenticated using ( public.is_admin() ) with check ( public.is_admin() );

alter table if exists public.communication_messages enable row level security;
create policy communication_messages_read_staff on public.communication_messages for select to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() );
create policy communication_messages_write_staff on public.communication_messages for all to authenticated using ( public.is_staff() or public.is_manager() or public.is_admin() ) with check ( public.is_staff() or public.is_manager() or public.is_admin() );

alter table if exists public.cash_closures enable row level security;
create policy cash_closures_read_manager_admin on public.cash_closures for select to authenticated using ( public.is_manager() or public.is_admin() );
create policy cash_closures_write_manager_admin on public.cash_closures for all to authenticated using ( public.is_manager() or public.is_admin() ) with check ( public.is_manager() or public.is_admin() );

