const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixRepairStatus() {
  console.log('🔧 Aplicando fix para repair_status enum...')
  
  try {
    // First, check current enum values
    console.log('📋 Verificando valores actuales del enum...')
    const { data: currentValues, error: checkError } = await supabase
      .rpc('exec_sql', { 
        sql: "SELECT unnest(enum_range(NULL::repair_status)) AS status_values;" 
      })
    
    if (checkError) {
      console.log('ℹ️  No se pudo verificar valores actuales (esto es normal si el enum no existe)')
    } else {
      console.log('📋 Valores actuales:', currentValues)
    }

    // Apply the migration
    console.log('🚀 Agregando "cancelado" al enum repair_status...')
    
    const migrationSQL = `
      DO $$ 
      BEGIN
        -- Check if the enum value already exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'cancelado' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'repair_status')
        ) THEN
          ALTER TYPE repair_status ADD VALUE 'cancelado';
          RAISE NOTICE 'Added cancelado to repair_status enum';
        ELSE
          RAISE NOTICE 'cancelado already exists in repair_status enum';
        END IF;
      END $$;
    `
    
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      console.error('❌ Error aplicando migración:', error)
      return false
    }

    // Verify the fix
    console.log('✅ Verificando que el fix se aplicó correctamente...')
    const { data: newValues, error: verifyError } = await supabase
      .rpc('exec_sql', { 
        sql: "SELECT unnest(enum_range(NULL::repair_status)) AS status_values;" 
      })
    
    if (verifyError) {
      console.error('❌ Error verificando:', verifyError)
      return false
    }

    console.log('📋 Nuevos valores del enum:', newValues)
    
    // Check if 'cancelado' is included
    const hasCancelado = newValues?.some(row => row.status_values === 'cancelado')
    
    if (hasCancelado) {
      console.log('✅ ¡Éxito! El estado "cancelado" se agregó correctamente al enum repair_status')
      console.log('🎉 El error "invalid input value for enum repair_status: cancelado" debería estar resuelto')
      return true
    } else {
      console.error('❌ Error: "cancelado" no se encontró en el enum después de la migración')
      return false
    }
    
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err)
    return false
  }
}

// Execute the fix
fixRepairStatus()
  .then(success => {
    if (success) {
      console.log('\n🎯 Migración completada exitosamente')
      console.log('💡 Ahora puedes usar el estado "cancelado" en las reparaciones')
    } else {
      console.log('\n❌ La migración falló')
      console.log('💡 Intenta ejecutar manualmente en Supabase Dashboard:')
      console.log('   ALTER TYPE repair_status ADD VALUE \'cancelado\';')
    }
    process.exit(success ? 0 : 1)
  })
  .catch(err => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
  })