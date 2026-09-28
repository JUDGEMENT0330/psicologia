import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const ruta = (p: string) => fileURLToPath(new URL(p, import.meta.url))

const { version } = createRequire(import.meta.url)('./package.json') as { version: string }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Una sola fuente para el número de versión: el `package.json`.
  define: { __VERSION_APP__: JSON.stringify(version) },
  resolve: {
    alias: {
      // Proveedor de datos: Supabase, protegido por RLS.
      '@datos': ruta('./src/lib/nube.ts'),
    },
  },
  build: {
    // Quien abre un enlace de evaluación no descarga el motor 3D ni las
    // gráficas: el formulario público es su propio trozo.
    rollupOptions: { output: { manualChunks: trozos } },
    chunkSizeWarningLimit: 1600,
  },
})

function trozos(id: string): string | undefined {
  if (!id.includes('node_modules')) return
  if (/[\\/]three[\\/]/.test(id)) return 'cerebro3d'
  if (/[\\/]node_modules[\\/](recharts|d3-|victory-)/.test(id)) return 'graficas'
  if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
  return 'proveedores'
}
