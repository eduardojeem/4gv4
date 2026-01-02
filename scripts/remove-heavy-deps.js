#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Removiendo dependencias pesadas temporalmente...');

// Lista de dependencias pesadas que podemos remover temporalmente
const heavyDependencies = [
  'html2canvas',
  'jspdf', 
  'xlsx',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  'framer-motion' // Ya tenemos wrapper optimizado
];

// Leer package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Crear backup
const backupPath = path.join(process.cwd(), 'package.json.backup');
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, JSON.stringify(packageJson, null, 2));
  console.log('📦 Backup creado en package.json.backup');
}

let removedCount = 0;

// Remover de dependencies
if (packageJson.dependencies) {
  heavyDependencies.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`❌ Removiendo ${dep} de dependencies`);
      delete packageJson.dependencies[dep];
      removedCount++;
    }
  });
}

// Remover de devDependencies
if (packageJson.devDependencies) {
  heavyDependencies.forEach(dep => {
    if (packageJson.devDependencies[dep]) {
      console.log(`❌ Removiendo ${dep} de devDependencies`);
      delete packageJson.devDependencies[dep];
      removedCount++;
    }
  });
}

// Escribir package.json actualizado
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log(`\n✅ Proceso completado:`);
console.log(`   - ${removedCount} dependencias removidas`);
console.log(`   - Backup guardado en package.json.backup`);
console.log(`\n💡 Para restaurar las dependencias:`);
console.log(`   cp package.json.backup package.json && npm install`);

console.log(`\n🚀 Ejecuta 'npm install' para actualizar node_modules`);