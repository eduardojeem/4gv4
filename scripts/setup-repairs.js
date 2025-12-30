#!/usr/bin/env node

/**
 * Script de Instalación: Sistema de Reparaciones
 * Ejecuta las migraciones de Supabase para repairs
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log('');
  log('=========================================', 'cyan');
  log(message, 'cyan');
  log('=========================================', 'cyan');
  console.log('');
}

function checkSupabaseCLI() {
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function executeSQL(filePath, description) {
  try {
    log(`Ejecutando: ${description}...`, 'white');
    
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Crear archivo temporal
    const tempFile = path.join(__dirname, 'temp.sql');
    fs.writeFileSync(tempFile, sqlContent);
    
    // Ejecutar con supabase CLI
    execSync(`supabase db execute --file ${tempFile}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    // Limpiar archivo temporal
    fs.unlinkSync(tempFile);
    
    log(`✓ ${description} completado exitosamente`, 'green');
    return true;
  } catch (error) {
    log(`✗ Error al ejecutar ${description}`, 'red');
    console.error(error.message);
    return false;
  }
}

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  header('INSTALACIÓN DEL SISTEMA DE REPARACIONES');

  // Verificar Supabase CLI
  if (!checkSupabaseCLI()) {
    log('✗ Error: Supabase CLI no está instalado', 'red');
    log('Instala Supabase CLI: https://supabase.com/docs/guides/cli', 'yellow');
    process.exit(1);
  }
  log('✓ Supabase CLI encontrado', 'green');

  // Verificar directorio
  if (!fs.existsSync('package.json')) {
    log('✗ Error: Ejecuta este script desde la raíz del proyecto', 'red');
    process.exit(1);
  }
  log('✓ Directorio correcto', 'green');

  // Paso 1: Crear estructura
  header('PASO 1: Creando estructura de tablas');
  
  const setupPath = path.join(__dirname, '..', 'supabase', 'migrations', '20241207_repairs_complete_setup.sql');
  
  if (!fs.existsSync(setupPath)) {
    log('✗ Error: No se encuentra el archivo de migración', 'red');
    log(`Buscando en: ${setupPath}`, 'yellow');
    process.exit(1);
  }

  const setupSuccess = executeSQL(setupPath, 'Estructura de tablas');
  
  if (!setupSuccess) {
    log('✗ Error al crear estructura de tablas', 'red');
    log('Revisa los logs arriba para más detalles', 'yellow');
    process.exit(1);
  }

  // Paso 2: Insertar datos de ejemplo
  header('PASO 2: Insertando datos de ejemplo');
  
  const answer = await askQuestion('¿Deseas insertar datos de ejemplo? (s/n): ');
  
  if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'si') {
    const seedPath = path.join(__dirname, '..', 'supabase', 'migrations', '20241207_repairs_seed_data.sql');
    
    if (!fs.existsSync(seedPath)) {
      log('✗ Error: No se encuentra el archivo de datos de ejemplo', 'red');
      process.exit(1);
    }

    const seedSuccess = executeSQL(seedPath, 'Datos de ejemplo');
    
    if (!seedSuccess) {
      log('⚠ Advertencia: Error al insertar datos de ejemplo', 'yellow');
      log('Esto puede ser normal si no existen clientes o técnicos', 'yellow');
      log('Ejecuta primero los scripts de customers y profiles', 'yellow');
    }
  } else {
    log('⊘ Datos de ejemplo omitidos', 'yellow');
  }

  // Paso 3: Verificación
  header('PASO 3: Verificando instalación');
  log('✓ Instalación completada', 'green');

  // Próximos pasos
  header('PRÓXIMOS PASOS');
  console.log('1. Verifica las tablas en Supabase Dashboard');
  console.log('2. Ejecuta la aplicación: npm run dev');
  console.log('3. Navega a /dashboard/repairs');
  console.log('');
  log('Si encuentras errores:', 'yellow');
  console.log('- Verifica que existan clientes en la tabla "customers"');
  console.log('- Verifica que existan técnicos en la tabla "profiles"');
  console.log('- Revisa los logs de Supabase para más detalles');
  console.log('');
  log('=========================================', 'cyan');
}

// Ejecutar
main().catch((error) => {
  log('✗ Error inesperado:', 'red');
  console.error(error);
  process.exit(1);
});
