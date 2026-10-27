const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const sharedSource = path.resolve(__dirname, '../src');

// Regional settings and the onboarding domain contract live in the web app's
// canonical `src` tree; make that shared source visible to Metro as well.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), sharedSource])];
config.resolver.nodeModulesPaths = [...new Set([
  ...(config.resolver.nodeModulesPaths ?? []),
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules'),
])];

module.exports = config;
