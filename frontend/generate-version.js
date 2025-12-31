// Generate version.js from package.json
// This script is run before building to ensure version.js is up to date

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Read package.json
  const packagePath = resolve(__dirname, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
  
  // Generate version.js content
  const versionContent = `// Version information - auto-generated from package.json
// This file is updated automatically during build
export const FRONTEND_VERSION = '${packageJson.version}';
`;

  // Write version.js
  const versionPath = resolve(__dirname, 'src', 'version.js');
  writeFileSync(versionPath, versionContent, 'utf-8');
  
  console.log(`✓ Generated version.js with version: ${packageJson.version}`);
} catch (error) {
  console.error('Error generating version.js:', error.message);
  process.exit(1);
}



