-- Add sample promotions data
INSERT INTO promotions (
  name,
  type,
  value,
  conditions,
  start_date,
  end_date,
  is_active
) VALUES 
(
  'Descuento 10% en compras mayores a $50',
  'percentage',
  10,
  '{"min_amount": 50}',
  NOW(),
  NOW() + INTERVAL '30 days',
  true
),
(
  'Descuento fijo $5 en compras mayores a $25',
  'fixed',
  5,
  '{"min_amount": 25}',
  NOW(),
  NOW() + INTERVAL '30 days',
  true
),
(
  'Promoción 2x1 en productos seleccionados',
  'bogo',
  0,
  '{"product_ids": []}',
  NOW(),
  NOW() + INTERVAL '15 days',
  true
)
ON CONFLICT (id) DO NOTHING;