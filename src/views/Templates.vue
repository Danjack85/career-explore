<template>
  <div class="page">
    <h1 class="page-title">实验模板库</h1>
    <p class="page-desc">
      每个模板都是 7 天、每天 ≤ 30 分钟、在宿舍就能做完的事。
      不知道从哪开始的话，挑一个顺眼的直接抄——先跑通一次，再谈自己设计。
    </p>

    <FilterChips v-model="activeTag" :chips="chips" group-label="按标签筛选" />

    <p v-if="styleHint" class="style-hint">
      已按你的盘点结果排序：你的作答偏向「{{ STYLE_LABEL[styleHint] }}」，匹配的模板排在了前面。
    </p>

    <template v-if="visible.length > 0">
      <article v-for="t in visible" :key="t.id" class="card tpl">
        <div class="tpl-head">
          <h2 class="tpl-title">{{ t.title }}</h2>
          <span class="tpl-direction">{{ t.direction }}</span>
        </div>

        <p class="tpl-suitable">适合：{{ t.suitable }}</p>

        <div class="tpl-hypo">
          <span class="tpl-hypo-label">假设示例</span>
          <p class="tpl-hypo-text">{{ t.hypothesis }}</p>
        </div>

        <button class="expand" type="button" :aria-expanded="expandedId === t.id" @click="toggle(t.id)">
          {{ expandedId === t.id ? '收起 7 天任务' : '看 7 天都做什么' }}
        </button>

        <ol v-if="expandedId === t.id" class="days">
          <li v-for="(day, i) in t.days" :key="i" class="day-item">
            <span class="day-num">D{{ i + 1 }}</span>
            <span class="day-text">{{ day }}</span>
          </li>
        </ol>

        <button
          class="btn-primary tpl-start"
          type="button"
          :disabled="startingId !== null"
          @click="start(t)"
        >
          {{ startingId === t.id ? '创建中…' : '用这个模板开始实验' }}
        </button>
      </article>
    </template>

    <div v-else class="empty">
      <p class="empty-text">「{{ activeTag }}」下暂时没有模板。</p>
      <button class="btn-primary" type="button" @click="activeTag = null">看全部模板</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TEMPLATES, createExperiment, templateTags } from '@/api'
import type { ExperimentTemplate, WorkStyle } from '@/api'
import FilterChips from '@/components/FilterChips.vue'

const router = useRouter()
const route = useRoute()

const activeTag = ref<string | null>(null)
const expandedId = ref<string | null>(null)
const startingId = ref<string | null>(null)
const error = ref('')

/**
 * 测评结果页带来的行事方式（/templates?style=build）。
 * 命中时把匹配的模板排前面并提示一句 —— 不隐藏其他模板，
 * 排序是建议，不是过滤。
 */
const styleHint = computed(() => {
  const s = typeof route.query.style === 'string' ? route.query.style : ''
  const valid: WorkStyle[] = ['build', 'analyze', 'people', 'express']
  return valid.includes(s as WorkStyle) ? (s as WorkStyle) : null
})

const STYLE_LABEL: Record<WorkStyle, string> = {
  build: '动手做出来',
  analyze: '把问题想清楚',
  people: '和人一起推进',
  express: '用表达输出',
}

const visible = computed(() => {
  const list =
    activeTag.value === null
      ? [...TEMPLATES]
      : TEMPLATES.filter((t) => t.tags.includes(activeTag.value as string))
  if (!styleHint.value) return list
  // 稳定排序：匹配的排前面，其余保持原序
  return list.sort((a, b) => {
    const am = a.styles.includes(styleHint.value as WorkStyle) ? 0 : 1
    const bm = b.styles.includes(styleHint.value as WorkStyle) ? 0 : 1
    return am - bm
  })
})

const chips = computed(() => [
  { value: null as string | null, label: '全部', count: TEMPLATES.length },
  ...templateTags().map((tag) => ({ value: tag as string | null, label: tag })),
])

function toggle(id: string): void {
  expandedId.value = expandedId.value === id ? null : id
}

function start(t: ExperimentTemplate): void {
  if (startingId.value) return
  startingId.value = t.id
  error.value = ''
  createExperiment({
    title: t.title,
    direction: t.direction,
    hypothesis: t.hypothesis,
    template_id: t.id,
  })
    .then((created) => router.push(`/experiment/${created.id}`))
    .catch(() => {
      error.value = '创建实验失败，请稍后再试。'
      startingId.value = null
    })
}
</script>

<style scoped lang="scss">
.style-hint {
  margin: $space-md 0 0;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-primary-soft;
  color: $color-text;
  font-size: $font-size-caption;
}

.tpl {
  margin-top: 12px;
}

.tpl-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.tpl-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}

.tpl-direction {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: $color-primary-soft;
  color: $color-primary;
  font-size: 12px;
  line-height: 1.6;
  white-space: nowrap;
}

.tpl-suitable {
  margin: 8px 0 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.tpl-hypo {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: $radius-button;
  background-color: $color-surface;
}

.tpl-hypo-label {
  font-size: 12px;
  color: $color-text-muted;
}

.tpl-hypo-text {
  margin: 4px 0 0;
  font-size: $font-size-caption;
  color: $color-text;
  line-height: 1.7;
}

.expand {
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: none;
  color: $color-primary;
  font-size: $font-size-caption;
  font-family: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.days {
  margin: 10px 0 0;
  padding: 12px;
  border-radius: $radius-button;
  background-color: $color-surface;
  list-style: none;
}

.day-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 5px 0;
  font-size: $font-size-caption;
  color: $color-text;
}

.day-num {
  flex: 0 0 auto;
  min-width: 24px;
  height: 22px;
  border-radius: 4px;
  background-color: $color-primary-soft;
  color: $color-primary;
  font-size: 11px;
  line-height: 22px;
  text-align: center;
}

.day-text {
  line-height: 1.7;
}

.tpl-start {
  width: 100%;
  margin-top: 12px;
}

.error {
  margin: $space-md 0 0;
  color: $color-danger;
  font-size: $font-size-caption;
}
</style>
