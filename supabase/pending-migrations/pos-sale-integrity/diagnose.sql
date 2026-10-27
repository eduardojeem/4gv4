-- Diagnóstico de solo lectura: por qué 01 o 03 abortan con *_CONTRACT_CHANGED.

-- 1) ¿Las funciones tienen saltos de línea de Windows (\r\n)? ¿Son las del repo?
--    md5_normalizado esperado (definición del repo):
--      process_pos_sale_atomic_v2 -> cb15d722ad047d3dea4b0c0a1fed9c80
--      dashboard_pos_summary_s1   -> 71248dedbbcce09d476661c1075d809c
--    Si coincide, la única diferencia eran los saltos de línea y 01/03 ya la toleran.
--    md5_sin_espacios esperado (ignora todos los espacios):
--      process_pos_sale_atomic_v2 -> 971122a3eeaf2cb61180c3cebb36093f
--      dashboard_pos_summary_s1   -> 9f5b94daa3d5f39beeebb4bce8bca300
--    Si este coincide y el otro no, la diferencia es solo de espacios: 01/03 la toleran.
select p.proname,
  position(E'\r' in p.prosrc) > 0 as tiene_crlf,
  p.prosrc ~ E'[ \t]+\r?\n' as espacios_al_final,
  position(E'\t' in p.prosrc) > 0 as tiene_tabs,
  md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) as md5_sin_espacios,
  length(p.prosrc) as largo,
  md5(replace(p.prosrc, E'\r\n', E'\n')) as md5_normalizado
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('process_pos_sale_atomic_v2', 'dashboard_pos_summary_s1');

-- 2) El bloque de IVA tal como está en producción (copiar el resultado completo).
select substring(
  replace(p.prosrc, E'\r\n', E'\n')
  from position('p_tax_rate := least' in replace(p.prosrc, E'\r\n', E'\n'))
  for 700
) as bloque_iva
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'process_pos_sale_atomic_v2';
