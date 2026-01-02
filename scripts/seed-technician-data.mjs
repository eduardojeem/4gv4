#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables de entorno faltantes para Supabase')
  console.log('- NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌')
  console.log('- SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function getTechnicianByEmail(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('email', email)
    .single()
  if (error) throw error
  return data
}

async function ensureCustomers(min = 3) {
  const { data: existing, error } = await supabase
    .from('customers')
    .select('id')
    .limit(min)
  if (error) throw error
  const have = existing?.length || 0
  if (have >= min) return existing.map(c => c.id)

  const demo = [
    { first_name: 'Juan', last_name: 'Pérez', phone: '+595981123456', email: 'juan.perez@example.com' },
    { first_name: 'María', last_name: 'González', phone: '+595981234567', email: 'maria.gonzalez@example.com' },
    { first_name: 'Carlos', last_name: 'López', phone: '+595981345678', email: 'carlos.lopez@example.com' },
  ]

  const { data: inserted, error: insertErr } = await supabase
    .from('customers')
    .insert(demo)
    .select('id')
  if (insertErr) throw insertErr
  return inserted.map(c => c.id)
}

function isoAt(hourOffsetDays, hour) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + hourOffsetDays, hour, 0, 0)
  return d.toISOString()
}

async function insertRepairs(technicianId, customerIds) {
  const payload = [
    {
      customer_id: customerIds[0],
      device_type: 'smartphone',
      device_brand: 'Apple',
      device_model: 'iPhone 13 Pro',
      serial_number: 'IP13P-001',
      problem_description: 'Pantalla rota, no responde al tacto',
      status: 'recibido',
      priority: 'high',
      urgency: 'urgent',
      technician_id: technicianId,
      estimated_cost: 3500.00,
      labor_cost: 500.00,
      location: 'Taller Principal',
      estimated_completion: isoAt(1, 9),
    },
    {
      customer_id: customerIds[1] || customerIds[0],
      device_type: 'laptop',
      device_brand: 'Dell',
      device_model: 'XPS 15 9520',
      serial_number: 'DXPS-9520',
      problem_description: 'Sobrecalentamiento y apagados aleatorios',
      diagnosis: 'Pasta térmica seca, ventiladores con polvo',
      status: 'diagnostico',
      priority: 'medium',
      urgency: 'normal',
      technician_id: technicianId,
      estimated_cost: 1200.00,
      labor_cost: 800.00,
      location: 'Mesa 2',
      estimated_completion: isoAt(2, 11),
    },
    {
      customer_id: customerIds[2] || customerIds[0],
      device_type: 'tablet',
      device_brand: 'Samsung',
      device_model: 'Galaxy Tab S8',
      serial_number: 'GTAB-S8',
      problem_description: 'Touch intermitente, líneas en pantalla',
      status: 'reparacion',
      priority: 'high',
      urgency: 'urgent',
      technician_id: technicianId,
      estimated_cost: 3200.00,
      labor_cost: 1200.00,
      location: 'Mesa 1',
      estimated_completion: isoAt(3, 14),
    },
    {
      customer_id: customerIds[0],
      device_type: 'desktop',
      device_brand: 'HP',
      device_model: 'Pavilion Gaming',
      serial_number: 'HP-PAV-G',
      problem_description: 'No da video, ventiladores giran',
      status: 'diagnostico',
      priority: 'medium',
      urgency: 'normal',
      technician_id: technicianId,
      estimated_cost: 2500.00,
      labor_cost: 600.00,
      location: 'Banco de pruebas',
      estimated_completion: isoAt(4, 10),
    },
    {
      customer_id: customerIds[1] || customerIds[0],
      device_type: 'accessory',
      device_brand: 'Apple',
      device_model: 'AirPods Pro 2',
      serial_number: 'APP-AP2',
      problem_description: 'Estuche de carga no funciona',
      status: 'recibido',
      priority: 'low',
      urgency: 'normal',
      technician_id: technicianId,
      estimated_cost: 800.00,
      labor_cost: 200.00,
      location: 'Mesa 3',
      estimated_completion: isoAt(5, 16),
    },
  ]

  const { data, error } = await supabase
    .from('repairs')
    .insert(payload)
    .select('id, device_brand, device_model, status, estimated_completion')
  if (error) throw error
  return data
}

async function insertNotesAndParts(repairs, technician) {
  for (const r of repairs) {
    await supabase.from('repair_notes').insert([
      { repair_id: r.id, author_id: technician.id, author_name: technician.full_name || 'Técnico', note_text: 'Inspección inicial realizada.', is_internal: true },
      { repair_id: r.id, author_id: technician.id, author_name: technician.full_name || 'Técnico', note_text: 'Cliente notificado del estado.', is_internal: false },
    ])
    await supabase.from('repair_parts').insert([
      { repair_id: r.id, part_name: 'Pantalla OEM', part_number: 'LCD-STD', quantity: 1, unit_cost: 3000.00, supplier: 'Tech Distributors SA', status: 'ordered' },
    ])
  }
}

async function run() {
  const email = 'johneduardoespinoza95@gmail.com'
  console.log('🚀 Insertando datos de ejemplo para sección de técnico')
  try {
    const { data: existingRepairs, error: countErr } = await supabase
      .from('repairs')
      .select('id', { count: 'exact', head: true })
      
    // The previous logic for hasData was slightly flawed if existingRepairs is null.
    // If countErr is null, we can trust existingRepairs.length or count.
    // But let's simplify.
    
    // Check technician existence first as it's critical
    let technician;
    try {
        technician = await getTechnicianByEmail(email);
    } catch (e) {
        console.error('❌ No se encontró el técnico con email:', email);
        console.log('⚠️ Asegúrate de que el usuario existe en Supabase Auth y en la tabla profiles.');
        process.exit(1);
    }

    if (!countErr && existingRepairs && existingRepairs.length > 0) {
      console.log('ℹ️ Ya existen reparaciones en la base de datos.')
      // Optionally continue? The user said "missing data", implying they want data.
      // If data exists but isn't showing, that's a different problem.
      // But verify-supabase said 0 repairs. So this check should pass.
    } else {
        const customerIds = await ensureCustomers(3)
        const repairs = await insertRepairs(technician.id, customerIds)
        await insertNotesAndParts(repairs, technician)
        console.log('✅ Datos de ejemplo insertados')
        console.log('🧰 Reparaciones creadas:', repairs.length)
        for (const r of repairs) {
          console.log(`- ${r.device_brand} ${r.device_model} • ${r.status} • ${r.estimated_completion}`)
        }
    }

  } catch (err) {
    console.error('❌ Error:', err.message || String(err))
    process.exit(1)
  }
}

// Check if file is run directly
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    run().catch(console.error);
} else if (process.argv[1] && process.argv[1].endsWith('seed-technician-data.mjs')) {
    // Fallback for some environments
    run().catch(console.error);
}

export { run }
