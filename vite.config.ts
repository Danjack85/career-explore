import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 打包进 Android WebView 时资源以 file:// 相对路径加载，
  // 必须用相对 base，否则 /assets/... 会 404。
  base: './',
  plugins: [vue()],
  build: {
    // 必须与 capacitor.config.ts 的 webDir 一致
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 让每个 .vue 的样式块和独立 .scss 都能直接用设计变量（$color-primary 等），
        // 不必逐个文件 @use。sass 要求 @use 必须在文件最前，这里的注入正好满足。
        additionalData: '@use "@/styles/variables.scss" as *;\n',
      },
    },
  },
})
