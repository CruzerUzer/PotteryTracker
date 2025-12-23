import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read package.json to get version
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

// Update version.js file with current version
const versionContent = `// Version information - auto-generated from package.json
// This file is updated automatically during build
export const FRONTEND_VERSION = '${packageJson.version}';
`
writeFileSync(resolve(__dirname, 'src/version.js'), versionContent, 'utf-8')

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
  server: {
    host: true, // or use '0.0.0.0' to listen on all network interfaces
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        cookieDomainRewrite: '',
        cookiePathRewrite: '/',
      }
    }
  }
})



