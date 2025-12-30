#!/usr/bin/env node

/**
 * Script para inicializar el repositorio de GitHub
 * Ejecuta: node scripts/init-repo.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Inicializando repositorio para GitHub...\n');

// Verificar que estamos en la raíz del proyecto
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: Ejecuta este script desde la raíz del proyecto');
  process.exit(1);
}

try {
  // Verificar si Git está inicializado
  try {
    execSync('git status', { stdio: 'ignore' });
    console.log('✅ Repositorio Git ya inicializado');
  } catch {
    console.log('📦 Inicializando repositorio Git...');
    execSync('git init');
    console.log('✅ Git inicializado');
  }

  // Agregar archivos al staging
  console.log('📁 Agregando archivos...');
  execSync('git add .');
  console.log('✅ Archivos agregados');

  // Crear commit inicial si no existe
  try {
    execSync('git log --oneline -1', { stdio: 'ignore' });
    console.log('✅ Ya existe historial de commits');
  } catch {
    console.log('💾 Creando commit inicial...');
    execSync('git commit -m "feat: initial commit - 4GV4 management system"');
    console.log('✅ Commit inicial creado');
  }

  // Crear rama main si no existe
  try {
    execSync('git branch -M main');
    console.log('✅ Rama main configurada');
  } catch {
    console.log('✅ Rama main ya existe');
  }

  console.log('\n🎉 Repositorio listo para GitHub!');
  console.log('\n📋 Próximos pasos:');
  console.log('1. Crea un repositorio en GitHub');
  console.log('2. Ejecuta: git remote add origin https://github.com/tu-usuario/4gv4.git');
  console.log('3. Ejecuta: git push -u origin main');
  console.log('\n💡 Tip: Asegúrate de configurar las variables de entorno en GitHub Secrets para CI/CD');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}