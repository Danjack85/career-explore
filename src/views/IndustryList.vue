<template>
  <div class="page">
    <h1 class="page-title">行业地图</h1>
    <p class="page-desc">每张卡都标注阶段、岗位、技能、风险，以及结论的来源和日期。</p>

    <FilterChips v-model="activeFilter" :chips="chips" group-label="按阶段筛选" />

    <p class="sourcing-note">
      10 个行业里，<strong>{{ sourced }}</strong> 个已挂上官方统计数据（可点开原文核验），
      其余 {{ total - sourced }} 个官方统计未单列该口径，卡片里会显式标注。
      所有卡片都不含薪资数字 —— 没有可引用的薪资来源。
    </p>

    <LoadState :loading="loading" :error="error" @retry="load" />

    <template v-if="!loading && !error">
      <template v-if="visible.length > 0">
        <router-link
          v-for="card in visible"
          :key="card.id"
          class="card industry"
          :to="`/industry/${card.id}`"
        >
          <div class="industry-head">
            <span class="industry-name">{{ card.name }}</span>
            <StageTag :stage="card.stage" />
          </div>
          <p class="industry-summary">{{ card.summary }}</p>
          <p class="industry-jobs">
            <span class="label">典型岗位</span>{{ card.jobs.slice(0, 4).join(' · ') }}
          </p>
          <p class="industry-meta">
            <span v-if="card.sources.length > 0" class="meta-sourced">
              数据 {{ card.source_date }} · {{ card.sources[0].name }}
            </span>
            <span v-else class="meta-unsourced">来源待人工补充</span>
            <span class="meta-updated">更新于 {{ card.updated_at }}</span>
          </p>
        </router-link>
      </template>

      <div v-else class="empty">
        <p class="empty-text">「{{ activeFilter }}」阶段暂时没有行业卡片。</p>
        <button class="btn-primary" type="button" @click="activeFilter = '全部'">看全部行业</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { INDUSTRY_STAGES, listIndustries, sourcedCount } from '@/api'
import type { IndustryCard } from '@/api'
import StageTag from '@/components/StageTag.vue'
import LoadState from '@/components/LoadState.vue'
import FilterChips from '@/components/FilterChips.vue'
import type { StageFilter } from '@/api'

type FilterValue = StageFilter

const cards = ref<IndustryCard[]>([])
const loading = ref(true)
const error = ref('')
const activeFilter = ref<FilterValue>('全部')

const { sourced, total } = sourcedCount()

const chips = computed(() => [
  { value: '全部' as FilterValue, label: '全部', count: cards.value.length },
  ...INDUSTRY_STAGES.map((stage) => ({
    value: stage as FilterValue,
    label: stage,
    count: cards.value.filter((card) => card.stage === stage).length,
  })),
])

const visible = computed(() =>
  activeFilter.value === '全部'
    ? cards.value
    : cards.value.filter((card) => card.stage === activeFilter.value)
)

// 来源状态由 api 层按证据文件算出（sourcedCount），这里不再自己判断

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    cards.value = await listIndustries()
  } catch {
    error.value = '行业数据读取失败，请重试。'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.sourcing-note {
  margin: $space-md 0 0;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-surface;
  color: $color-text-secondary;
  font-size: $font-size-caption;
}

.industry {
  margin-top: 12px;
  color: $color-text;
  text-decoration: none;
}

.industry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.industry-name {
  font-size: 16px;
  font-weight: 500;
}

.industry-summary {
  margin: 8px 0 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.industry-jobs {
  margin: 8px 0 0;
  font-size: $font-size-caption;
  color: $color-text;
}

.label {
  margin-right: 6px;
  color: $color-text-muted;
}

.industry-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin: 8px 0 0;
  font-size: 12px;
}

.meta-sourced {
  color: $color-success;
}

.meta-unsourced {
  color: $color-warning;
}

.meta-updated {
  color: $color-text-muted;
}

.empty-text {
  margin: 0 0 12px;
}
</style>
