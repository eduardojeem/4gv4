const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting debug build process...');

// Create a temporary tsconfig that excludes large files
const originalTsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
const debugTsConfig = {
  ...originalTsConfig,
  exclude: [
    ...originalTsConfig.exclude,
    'src/components/dashboard/customers/NotificationCenter.tsx',
    'src/components/admin/inventory/inventory-management.tsx',
    'src/components/dashboard/product-configuration.tsx',
    'src/components/dashboard/customers/CustomerHistory.tsx',
    'src/components/dashboard/customers/CustomerDataDialog.tsx',
    'src/components/dashboard/product-details-dialog-v2.tsx',
    'src/components/admin/supplier-management.tsx',
    'src/components/dashboard/customer-form.tsx'
  ]
};

// Write temporary config
fs.writeFileSync('tsconfig.debug.json', JSON.stringify(debugTsConfig, null, 2));

try {
  console.log('Running TypeScript check with debug config...');
  execSync('npx tsc --noEmit --project tsconfig.debug.json', { stdio: 'inherit', timeout: 60000 });
  console.log('TypeScript check passed!');
  
  console.log('Running Next.js build...');
  execSync('npx next build', { stdio: 'inherit', timeout: 120000 });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
} finally {
  // Clean up
  if (fs.existsSync('tsconfig.debug.json')) {
    fs.unlinkSync('tsconfig.debug.json');
  }
}