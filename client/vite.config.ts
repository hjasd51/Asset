import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    // UNC 네트워크 드라이브에서 OS 파일 감시가 동작하지 않아 폴링 방식으로 전환
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
})
