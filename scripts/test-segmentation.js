#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno no encontradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSegmentationSystem() {
  try {
    console.log('🧪 Probando conexión al sistema de segmentación...')
    
    // Test 1: Verificar si las tablas existen
    console.log('\n1️⃣ Verificando tablas existentes...')
    
    const { data: segments, error: segmentsError } = await supabase
      .from('customer_segments')
      .select('*')
      .limit(5)
    
    if (segmentsError) {
      console.log('❌ Tabla customer_segments no existe o no es accesible')
      console.log('Error:', segmentsError.message)
      console.log('\n📋 ACCIÓN REQUERIDA:')
      console.log('Ejecuta la configuración manual siguiendo: MANUAL_SEGMENTATION_SETUP.md')
      return false
    }
    
    console.log('✅ Tabla customer_segments accesible')
    console.log(`📊 Segmentos encontrados: ${segments?.length || 0}`)
    
    if (segments && segments.length > 0) {
      console.log('\n📋 Segmentos existentes:')
      segments.forEach(segment => {
        console.log(`  • ${segment.name} (${segment.color}) - ${segment.is_active ? 'Activo' : 'Inactivo'}`)
      })
    }
    
    // Test 2: Verificar tabla de analytics
    const { data: analytics, error: analyticsError } = await supabase
      .from('segment_analytics')
      .select('*')
      .limit(1)
    
    if (analyticsError) {
      console.log('⚠️  Tabla segment_analytics no accesible:', analyticsError.message)
    } else {
      console.log('✅ Tabla segment_analytics accesible')
    }
    
    // Test 3: Verificar tabla de insights
    const { data: insights, error: insightsError } = await supabase
      .from('ai_insights')
      .select('*')
      .limit(3)
    
    if (insightsError) {
      console.log('⚠️  Tabla ai_insights no accesible:', insightsError.message)
    } else {
      console.log('✅ Tabla ai_insights accesible')
      console.log(`🧠 Insights encontrados: ${insights?.length || 0}`)
      
      if (insights && insights.length > 0) {
        console.log('\n🔍 Insights disponibles:')
        insights.forEach(insight => {
          console.log(`  • ${insight.title} (${insight.type}, impacto: ${insight.impact})`)
        })
      }
    }
    
    // Test 4: Probar inserción de segmento de prueba
    console.log('\n2️⃣ Probando creación de segmento...')
    
    const testSegment = {
      name: 'Test Segmento - ' + Date.now(),
      description: 'Segmento de prueba creado automáticamente',
      criteria: { test: true },
      color: '#FF9500',
      icon: 'test-tube',
      priority: 5,
      tags: ['test', 'automatico']
    }
    
    const { data: newSegment, error: createError } = await supabase
      .from('customer_segments')
      .insert(testSegment)
      .select()
      .single()
    
    if (createError) {
      console.log('❌ Error creando segmento de prueba:', createError.message)
      return false
    }
    
    console.log('✅ Segmento de prueba creado exitosamente')
    console.log(`📝 ID: ${newSegment.id}`)
    
    // Test 5: Limpiar segmento de prueba
    const { error: deleteError } = await supabase
      .from('customer_segments')
      .delete()
      .eq('id', newSegment.id)
    
    if (deleteError) {
      console.log('⚠️  No se pudo eliminar el segmento de prueba:', deleteError.message)
    } else {
      console.log('🧹 Segmento de prueba eliminado')
    }
    
    console.log('\n🎉 ¡Sistema de segmentación funcionando correctamente!')
    console.log('\n🚀 Próximos pasos:')
    console.log('1. Ve a /dashboard/customers en tu aplicación')
    console.log('2. Busca la sección "Sistema de Segmentación IA"')
    console.log('3. Crea tus primeros segmentos personalizados')
    
    return true
    
  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message)
    return false
  }
}

// Ejecutar pruebas
if (require.main === module) {
  testSegmentationSystem().then(success => {
    process.exit(success ? 0 : 1)
  })
}

module.exports = { testSegmentationSystem }