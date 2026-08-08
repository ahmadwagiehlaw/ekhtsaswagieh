import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor';
            if (id.includes('xlsx') || id.includes('docxtemplater') || id.includes('pizzip') || id.includes('file-saver') || id.includes('browser-image-compression')) return 'files_engine';
            if (id.includes('lucide-react')) return 'ui';
          }
        }
      }
    }
  }
})
