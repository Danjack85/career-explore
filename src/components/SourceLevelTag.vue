<template>
  <span class="source-tag" :class="toneClass">{{ level }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SourceLevel } from '@/api'

const props = defineProps<{ level: SourceLevel }>()

// 前 4 级用主色系（靠深浅区分可信度），后 2 级用灰系。
// 配色规则见 docs/DESIGN.md。
const TONE: Record<SourceLevel, string> = {
  官方数据: 'tone-l1',
  招聘平台报告: 'tone-l2',
  券商研报: 'tone-l3',
  深度媒体: 'tone-l4',
  从业者访谈: 'tone-l5',
  自媒体: 'tone-l6',
}

const toneClass = computed(() => TONE[props.level])
</script>

<style scoped lang="scss">
.source-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
  white-space: nowrap;
}

.tone-l1 {
  background-color: rgba(30, 64, 175, 0.14);
  color: #1e40af;
}

.tone-l2 {
  background-color: rgba(29, 78, 216, 0.12);
  color: #1d4ed8;
}

.tone-l3 {
  background-color: $color-primary-soft;
  color: $color-primary;
}

.tone-l4 {
  background-color: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.tone-l5 {
  background-color: rgba(75, 85, 99, 0.1);
  color: #4b5563;
}

.tone-l6 {
  border: 1px dashed rgba(107, 114, 128, 0.5);
  background-color: transparent;
  color: $color-text-secondary;
}
</style>
