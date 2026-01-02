#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

console.log('🔍 Analizando dependencias para optimización...')

// Dependencias que pueden ser removidas temporalmente para reducir bundle
const HEAVY_DEPENDENCIES_TO_REMOVE = [
  'html2canvas',
  'jspdf',
  'jspdf-autotable',
  'xlsx',
  '@zxing/library',
  'html5-qrcode',
  'jsbarcode',
  'browser-image-compression',
  'react-window',
  '@tanstack/react-virtual'
]

// Dependencias que pueden ser optimizadas pero no removidas
const DEPENDENCIES_TO_OPTIMIZE = [
  'framer-motion',
  'recharts',
  'date-fns',
  'lucide-react'
]

try {
  // Leer package.json
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  
  console.log('\n📦 Dependencias actuales:', Object.keys(packageJson.dependencies).length)
  
  // Crear backup
  writeFileSync('package.json.backup', JSON.stringify(packageJson, null, 2))
  console.log('💾 Backup creado: package.json.backup')
  
  // Remover dependencias pesadas temporalmente
  let removedCount = 0
  HEAVY_DEPENDENCIES_TO_REMOVE.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`🗑️  Removiendo temporalmente: ${dep}`)
      delete packageJson.dependencies[dep]
      removedCount++
    }
  })
  
  console.log(`\n✅ Dependencias removidas: ${removedCount}`)
  console.log('📦 Dependencias restantes:', Object.keys(packageJson.dependencies).length)
  
  // Guardar package.json optimizado
  writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
  
  console.log('\n🔄 Reinstalando dependencias optimizadas...')
  execSync('npm install', { stdio: 'inherit' })
  
  console.log('\n✅ Optimización de dependencias completada')
  console.log('\n⚠️  IMPORTANTE: Algunas funcionalidades pueden estar temporalmente deshabilitadas')
  console.log('   Para restaurar: cp package.json.backup package.json && npm install')
  
} catch (error) {
  console.error('❌ Error durante la optimización:', error.message)
  process.exit(1)
}