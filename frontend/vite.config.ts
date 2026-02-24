import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/auth": "http://127.0.0.1:8000",
      "/analytics": "http://127.0.0.1:8000",
      "/recommendations": "http://127.0.0.1:8000",
      "/config": "http://127.0.0.1:8000",
    },
  },
})
