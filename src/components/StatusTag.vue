<template>
  <span class="status-tag" :class="toneClass">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExperimentStatus } from '@/api'

const props = defineProps<{ status: ExperimentStatus }>()

const LABELS: Record<ExperimentStatus, string> = {
  planned: '待开始',
  running: '进行中',
  done: '已结束',
  dropped: '已放弃',
}

const TONE: Record<ExperimentStatus, string> = {
  planned: 'tone-planned',
  running: 'tone-running',
  done: 'tone-done',
  dropped: 'tone-dropped',
}

const label = computed(() => LABELS[props.status])
const toneClass = computed(() => TONE[props.status])
</script>

<style scoped lang="scss">
.status-tag {
  display: inline-block;
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
  white-space: nowrap;
}

.tone-planned {
  background-color: $color-surface;
  color: $color-text-secondary;
}

.tone-running {
  background-color: $color-primary-soft;
  color: $color-primary;
}

.tone-done {
  background-color: rgba(21, 128, 61, 0.1);
  color: $color-success;
}

.tone-dropped {
  background-color: rgba(107, 114, 128, 0.14);
  color: $color-text-secondary;
}
</style>
