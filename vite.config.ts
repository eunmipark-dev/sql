import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // SQL 실습 엔진(PGlite)은 wasm·데이터 파일을 직접 찾아 읽으므로 미리 묶지 않는다
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
})
