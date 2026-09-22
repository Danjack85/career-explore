<template>
  <div class="chip-row" role="group" :aria-label="groupLabel">
    <button
      v-for="chip in chips"
      :key="chip.label"
      class="chip"
      :class="{ active: chip.value === modelValue }"
      type="button"
      @click="emit('update:modelValue', chip.value)"
    >
      {{ chip.label }}
      <span v-if="chip.count !== undefined" class="count">{{ chip.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | null">
/**
 * 横向滚动的筛选 chip 行。
 *
 * 行业列表和信息雷达都要这个控件，此前两处各写了一份样式，
 * 改一次要改两遍、还容易漂移，所以抽成组件。
 *
 * 可点高度约 36px，低于 docs/DESIGN.md 的 44px 通则 —— 这是有意的：
 * chip 行参考 Material 的 32dp 紧凑规格，且相邻项间距足够大。
 */
interface Chip {
  value: T
  label: string
  count?: number
}

defineProps<{
  chips: Chip[]
  modelValue: T
  /** 无障碍分组名。不用 aria-label 作属性名：泛型组件下 kebab-case 与 camelCase 推断不一致 */
  groupLabel: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<style scoped lang="scss">
.chip-row {
  display: flex;
  gap: 8px;
  margin-top: $space-md;
  padding-bottom: 4px;
  overflow-x: auto;
}

.chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid $color-border;
  border-radius: 999px;
  background-color: $color-bg;
  color: $color-text-secondary;
  font-size: $font-size-caption;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.chip.active {
  border-color: $color-primary;
  background-color: $color-primary-soft;
  color: $color-primary;
  font-weight: 500;
}

.count {
  color: $color-text-muted;
  font-size: 11px;
}

.chip.active .count {
  color: $color-primary;
}
</style>
