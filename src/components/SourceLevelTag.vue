<template>
  <span class="source-tag" :class="toneClass">{{ level }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SourceLevel } from '@/api'

const props = defineProps<{ level: SourceLevel }>()

// 前 4 级用主色系，后 2 级用灰系。配色规则见 docs/DESIGN.md。
//
// 前 4 级原先靠「同一蓝色由深到浅」区分，但浅的那几档文字色对比度不足
// （#3B82F6 只有 3.29:1，远低于 4.5）。现在改为：
// **文字色只用深蓝的三档，靠底色透明度递减表示可信度降低**。
// 这样既不丢「越往下越浅」的视觉梯度，文字又都够深、可读。
// 每一档的实测对比度见 docs/DESIGN.md。
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

/* 可信度递减：文字色固定在三档深蓝，底色逐渐变浅 */
.tone-l1 {
  background-color: rgba(30, 58, 138, 0.14);
  color: #1e3a8a;
}

.tone-l2 {
  background-color: rgba(30, 64, 175, 0.12);
  color: #1e40af;
}

.tone-l3 {
  background-color: rgba(29, 78, 216, 0.1);
  color: #1d4ed8;
}

.tone-l4 {
  background-color: rgba(37, 99, 235, 0.06);
  color: #2563eb;
}

/* 后两级换灰系，与「可作结论依据」的前四级拉开 */
.tone-l5 {
  background-color: rgba(75, 85, 99, 0.1);
  color: #4b5563;
}

.tone-l6 {
  border: 1px dashed rgba(103, 111, 124, 0.5);
  background-color: transparent;
  color: $color-text-muted;
}
</style>
