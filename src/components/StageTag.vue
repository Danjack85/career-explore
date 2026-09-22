<template>
  <span class="stage-tag" :class="toneClass">{{ stage }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IndustryStage } from '@/api'

const props = defineProps<{ stage: IndustryStage }>()

// 五档各一色。衰退与低谷观察用警示色（不用危险色），靠描边区分两者。
const TONE: Record<IndustryStage, string> = {
  萌发: 'tone-seed',
  成长: 'tone-growth',
  成熟: 'tone-mature',
  衰退: 'tone-decline',
  低谷观察: 'tone-watch',
}

const toneClass = computed(() => TONE[props.stage])
</script>

<style scoped lang="scss">
.stage-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
  white-space: nowrap;
}

.tone-seed {
  background-color: rgba(14, 116, 144, 0.1);
  color: #0e7490;
}

.tone-growth {
  background-color: $color-primary-soft;
  color: $color-primary;
}

.tone-mature {
  background-color: rgba(75, 85, 99, 0.1);
  color: #4b5563;
}

.tone-decline {
  background-color: rgba(180, 83, 9, 0.1);
  color: $color-warning;
}

.tone-watch {
  border: 1px solid rgba(180, 83, 9, 0.4);
  background-color: transparent;
  color: $color-warning;
}
</style>
