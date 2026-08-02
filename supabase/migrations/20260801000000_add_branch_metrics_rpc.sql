-- Metricas de sucursales en una sola consulta agregada.
--
-- /api/admin/branches calculaba las metricas con 6 consultas POR sucursal
-- (N+1: 15 sucursales = 90 consultas por carga), y ademas contaba las ventas
-- trayendo las filas, lo que PostgREST corta en 1000 registros y falseaba
-- tanto el conteo como la facturacion del mes.
--
-- El total de la venta se lee via to_jsonb porque el esquema quedo con deriva:
-- algunas instalaciones tienen `sales.total_amount`, otras `sales.total`, y
-- `to_jsonb(x) ->> 'col'` devuelve NULL en vez de fallar si la columna no existe.

BEGIN;

CREATE OR REPLACE FUNCTION public.branch_metrics(
  p_branch_ids uuid[],
  p_month_start timestamptz
)
RETURNS TABLE (
  branch_id uuid,
  users_count bigint,
  primary_users_count bigint,
  registers_count bigint,
  open_registers_count bigint,
  sales_count bigint,
  revenue_total numeric,
  repairs_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    COALESCE(a.users_count, 0)::bigint,
    COALESCE(a.primary_users_count, 0)::bigint,
    COALESCE(c.registers_count, 0)::bigint,
    COALESCE(c.open_registers_count, 0)::bigint,
    COALESCE(s.sales_count, 0)::bigint,
    COALESCE(s.revenue_total, 0)::numeric,
    COALESCE(r.repairs_count, 0)::bigint
  FROM unnest(p_branch_ids) AS b(id)
  LEFT JOIN (
    SELECT uba.branch_id AS bid,
           COUNT(*) AS users_count,
           COUNT(*) FILTER (WHERE uba.is_primary) AS primary_users_count
    FROM public.user_branch_assignments uba
    WHERE uba.branch_id = ANY (p_branch_ids)
      AND uba.is_active
    GROUP BY uba.branch_id
  ) a ON a.bid = b.id
  LEFT JOIN (
    SELECT cr.branch_id AS bid,
           COUNT(*) AS registers_count,
           COUNT(*) FILTER (WHERE cr.is_open) AS open_registers_count
    FROM public.cash_registers cr
    WHERE cr.branch_id = ANY (p_branch_ids)
    GROUP BY cr.branch_id
  ) c ON c.bid = b.id
  LEFT JOIN (
    SELECT sa.branch_id AS bid,
           COUNT(*) AS sales_count,
           SUM(COALESCE(
             (to_jsonb(sa) ->> 'total_amount')::numeric,
             (to_jsonb(sa) ->> 'total')::numeric,
             0
           )) AS revenue_total
    FROM public.sales sa
    WHERE sa.branch_id = ANY (p_branch_ids)
      AND sa.created_at >= p_month_start
    GROUP BY sa.branch_id
  ) s ON s.bid = b.id
  LEFT JOIN (
    SELECT re.branch_id AS bid, COUNT(*) AS repairs_count
    FROM public.repairs re
    WHERE re.branch_id = ANY (p_branch_ids)
    GROUP BY re.branch_id
  ) r ON r.bid = b.id;
$$;

-- Solo el backend (service_role) la ejecuta; la ruta ya valida la organizacion.
REVOKE ALL ON FUNCTION public.branch_metrics(uuid[], timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.branch_metrics(uuid[], timestamptz) TO service_role;

COMMIT;
