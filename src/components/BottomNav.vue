<template>
  <nav class="bottom-nav" aria-label="主导航">
    <router-link
      v-for="item in items"
      :key="item.path"
      class="nav-item"
      :class="{ active: isActive(item.path) }"
      :to="item.path"
    >
      <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

interface NavItem {
  path: string
  label: string
  icon: string
}

// 图标用 emoji，不引入图标库
const items: NavItem[] = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/industry', label: '行业', icon: '🗺️' },
  { path: '/info', label: '信息', icon: '📡' },
  { path: '/plan', label: '计划', icon: '🎯' },
]

const route = useRoute()

function isActive(path: string): boolean {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  display: flex;
  border-top: 1px solid $color-border;
  background-color: $color-bg;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 0 6px;
  color: $color-text-secondary;
  font-size: $font-size-caption;
  text-decoration: none;
}

.nav-item.active {
  color: $color-primary;
  font-weight: 500;
}

.nav-icon {
  font-size: 18px;
  line-height: 1;
}

.nav-label {
  line-height: 1.2;
}
</style>
