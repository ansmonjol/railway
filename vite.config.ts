import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // SPA mode: the build prerenders an HTML shell and nothing is server-rendered.
  plugins: [tailwindcss(), tanstackStart({ spa: { enabled: true } }), viteReact()],
})
