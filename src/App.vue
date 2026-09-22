<template>
  <div class="app-shell">
    <main class="app-main" :class="{ 'with-nav': showNav }">
      <router-view />
    </main>
    <BottomNav v-if="showNav" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { registerAndroidBack } from '@/utils/nativeBack'
import type { BackHandlerHandle } from '@/utils/nativeBack'

// 底部导航只出现在四个主页面；测评、实验、详情等流程页保持专注，不显示 tab。
const TAB_PATHS = new Set(['/', '/industry', '/info', '/plan'])

const route = useRoute()
const router = useRouter()
const showNav = computed(() => TAB_PATHS.has(route.path))

// Android 返回键：子页面回上一页，首页才退出应用（详见 utils/nativeBack.ts）
let backHandler: BackHandlerHandle | null = null

onMounted(() => {
  backHandler = registerAndroidBack(router)
})

onBeforeUnmount(() => {
  void backHandler?.remove()
})
</script>

<style lang="scss">
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background-color: $color-bg;
  color: $color-text;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  font-size: $font-size-body;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

#app {
  min-height: 100vh;
}

/* 页面容器与通用块，供各页面复用 */
.page {
  padding: $space-lg $space-md $space-lg;
}

.page-title {
  display: block;
  margin: 0;
  font-size: $font-size-title;
  font-weight: 600;
  line-height: 1.4;
}

.page-desc {
  display: block;
  margin: $space-sm 0 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.section-title {
  display: block;
  margin: $space-lg 0 $space-sm;
  font-size: $font-size-body;
  font-weight: 600;
}

.card {
  display: block;
  padding: $space-md;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background-color: $color-bg;
}

.empty {
  padding: $space-lg $space-md;
  border: 1px dashed $color-border;
  border-radius: $radius-card;
  background-color: $color-surface;
  color: $color-text-secondary;
  font-size: $font-size-caption;
  text-align: center;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: $control-height;
  padding: 0 $space-md;
  border: 0;
  border-radius: $radius-button;
  font-size: $font-size-body;
  font-family: inherit;
  cursor: pointer;
}

.btn-primary {
  background-color: $color-primary;
  color: #fff;
}

.btn-secondary {
  border: 1px solid #d1d5db;
  background-color: transparent;
  color: #374151;
}
</style>

<style scoped lang="scss">
.app-main.with-nav {
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
}
</style>
