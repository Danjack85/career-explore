<template>
  <div v-if="loading" class="empty">正在读取…</div>
  <div v-else-if="error" class="empty">
    <p class="empty-text">{{ error }}</p>
    <button class="btn-primary" type="button" @click="emit('retry')">重试</button>
  </div>
</template>

<script setup lang="ts">
// 统一的加载 / 失败状态。空状态由各页面自己渲染（一句话 + 一个动作按钮）。
defineProps<{
  loading: boolean
  error: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<style scoped lang="scss">
.empty-text {
  margin: 0 0 12px;
}
</style>
