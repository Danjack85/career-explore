import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // .vite 是 dev server 的预打包缓存，内容是第三方库的转译产物，
    // 不忽略它会导致「先 pnpm dev 再 pnpm lint」报出几百个与自己代码无关的错误。
    ignores: [
      'dist/**',
      'android/**',
      'release/**',
      'legacy/**',
      'node_modules/**',
      '.vite/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    // tools/ 是 Node 脚本（构建期运行），不是浏览器代码，需要 Node 全局变量。
    // 这里手写而不用 globals 包，是为了不引入新依赖。
    files: ['tools/**/*.mjs', 'tools/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    rules: {
      // 骨架阶段允许用 <a> 之类的原生元素做占位，不强制多词组件名之外的额外约束
      'vue/multi-word-component-names': 'off',
      // 以下两条是纯排版偏好：中文短文案写在一行更易读，不强制拆行
      'vue/singleline-html-element-content-newline': 'off',
      'vue/max-attributes-per-line': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  }
)
