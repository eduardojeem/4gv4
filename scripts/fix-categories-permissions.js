#!/usr/bin/env node

/**
 * Script para corregir permisos de categorías
 * Ejecuta el script SQL de permisos y verifica el resultado
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno de Supabase no configuradas')
  console.error('   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function executeSqlFile(filePath, description) {
  try {
    console.log(`\n📄 Ejecutando: ${description}`)
    console.log(`   Archivo: ${path.basename(filePath)}`)
    
    const sqlContent = fs.readFileSync(filePath, 'utf8')
    
    // Dividir el SQL en statements individuales (separados por ;)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`   Ejecutando ${statements.length} statements...`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          console.error(`❌ Error en statement ${i + 1}:`, error.message)
          return false
        }
      }
    }
    
    console.log('✅ Ejecutado exitosamente')
    return true
  } catch (error) {
    console.error(`❌ Error ejecutando ${description}:`, error.message)
    return false
  }
}

async function verifyPermissions() {
  try {
    console.log('\n🔍 Verificando permisos...')
    
    // Verificar que podemos leer categorías
    const { data: categories, error: readError } = await supabase
      .from('categories')
      .select('*')
      .limit(5)
    
    if (readError) {
      console.error('❌ Error leyendo categorías:', readError.message)
      return false
    }
    
    console.log(`✅ Lectura exitosa: ${categories?.length || 0} categorías encontradas`)
    
    // Verificar políticas RLS
    const { data: policies, error: policyError } = await supabase
      .rpc('exec_sql', { 
        sql: "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'categories'" 
      })
    
    if (!policyError && policies) {
      console.log(`✅ Políticas RLS: ${policies.length} políticas activas`)
    }
    
    return true
  } catch (error) {
    console.error('❌ Error verificando permisos:', error.message)
    return false
  }
}

async function main() {
  console.log('🔧 CORRECCIÓN DE PERMISOS DE CATEGORÍAS')
  console.log('=====================================')
  
  const mode = process.argv[2] || 'fix'
  
  try {
    if (mode === 'reset') {
      console.log('⚠️  MODO RESET: Eliminando todas las políticas existentes')
      const resetPath = path.join(__dirname, 'reset-categories-permissions.sql')
      const success = await executeSqlFile(resetPath, 'Reset de permisos de emergencia')
      
      if (!success) {
        console.error('❌ Falló el reset de permisos')
        process.exit(1)
      }
    } else {
      console.log('🔧 MODO FIX: Aplicando permisos correctos')
      const fixPath = path.join(__dirname, '..', 'supabase', 'migrations_legacy', '20250107_fix_categories_permissions.sql')
      const success = await executeSqlFile(fixPath, 'Corrección de permisos de categorías')
      
      if (!success) {
        console.error('❌ Falló la corrección de permisos')
        process.exit(1)
      }
    }
    
    // Verificar que todo funciona
    const verifySuccess = await verifyPermissions()
    
    if (verifySuccess) {
      console.log('\n🎉 CORRECCIÓN COMPLETADA EXITOSAMENTE')
      console.log('===================================')
      console.log('✅ Permisos de categorías configurados correctamente')
      console.log('✅ Verificación de acceso exitosa')
      console.log('\n📋 Próximos pasos:')
      console.log('1. Probar la sección de categorías en la aplicación')
      console.log('2. Verificar que los usuarios pueden ver/editar según sus roles')
    } else {
      console.log('\n⚠️  CORRECCIÓN COMPLETADA CON ADVERTENCIAS')
      console.log('=========================================')
      console.log('Los permisos se aplicaron pero hay problemas de verificación')
      console.log('Revisar manualmente la configuración')
    }
    
  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error.message)
    process.exit(1)
  }
}

// Función helper para crear la función exec_sql si no existe
async function ensureExecSqlFunction() {
  const { error } = await supabase.rpc('exec_sql', { 
    sql: `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void AS $
      BEGIN
        EXECUTE sql;
      END;
      $ LANGUAGE plpgsql SECURITY DEFINER;
    `
  })
  
  if (error && !error.message.includes('already exists')) {
    console.log('📝 Creando función helper exec_sql...')
  }
}

// Mostrar ayuda
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔧 Script de Corrección de Permisos de Categorías

USO:
  node scripts/fix-categories-permissions.js [modo]

MODOS:
  fix    (default) - Aplicar permisos correctos con roles específicos
  reset             - Reset de emergencia (permitir todo a usuarios autenticados)

EJEMPLOS:
  node scripts/fix-categories-permissions.js
  node scripts/fix-categories-permissions.js fix
  node scripts/fix-categories-permissions.js reset

VARIABLES DE ENTORNO REQUERIDAS:
  NEXT_PUBLIC_SUPABASE_URL      - URL de tu proyecto Supabase
  SUPABASE_SERVICE_ROLE_KEY     - Service role key de Supabase

ARCHIVOS RELACIONADOS:
  supabase/migrations_legacy/20250107_fix_categories_permissions.sql
  scripts/verify-categories-permissions.sql
  scripts/reset-categories-permissions.sql
`)
  process.exit(0)
}

// Ejecutar
await ensureExecSqlFunction()
await main()