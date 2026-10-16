-- Read-only. Resolve each discrepancy against the original agreement before
-- using the audited credit editor. This query never repairs or forgives debt.
with plan as (
  select credit_id, count(*) as actual_installments, sum(amount) as scheduled_total,
    sum(coalesce(amount_paid,0)) as paid_in_installments
  from public.credit_installments group by credit_id
), payments as (
  select credit_id, sum(amount) as recorded_payments from public.credit_payments group by credit_id
)
select c.organization_id,c.id,c.credit_code,c.status,
  c.principal as header_total,p.scheduled_total,c.term_months as header_installments,p.actual_installments,
  coalesce(pay.recorded_payments,0) as recorded_payments,p.paid_in_installments,
  greatest(0,p.scheduled_total-p.paid_in_installments) as remaining_in_plan
from public.customer_credits c left join plan p on p.credit_id=c.id left join payments pay on pay.credit_id=c.id
where p.credit_id is null or abs(c.principal-p.scheduled_total)>0.01
  or c.term_months<>p.actual_installments
  or abs(coalesce(pay.recorded_payments,0)-p.paid_in_installments)>0.01
order by c.organization_id,c.id;
