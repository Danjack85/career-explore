<template>
  <div class="page">
    <h1 class="page-title">我的实验</h1>
    <p class="page-desc">每个实验 7 天。每天记录能量和喜恶，第 7 天给出结论。</p>

    <LoadState :loading="loading" :error="error" @retry="load" />

    <template v-if="!loading && !error">
      <section class="group">
        <h2 class="section-title">进行中</h2>

        <router-link
          v-for="row in runningRows"
          :key="row.experiment.id"
          class="card experiment"
          :to="`/experiment/${row.experiment.id}`"
        >
          <div class="experiment-head">
            <span class="experiment-title">{{ row.experiment.title }}</span>
            <StatusTag :status="row.experiment.status" />
          </div>
          <p class="experiment-meta">
            {{ row.experiment.direction }} · {{ row.experiment.start_date }} → {{ row.experiment.end_date }}
          </p>
          <div class="bar"><span class="bar-fill" :style="{ width: row.width }" /></div>
          <p class="experiment-progress">已记录 {{ row.progress.logged }} / {{ row.progress.total }} 天</p>
        </router-link>

        <div v-if="runningRows.length === 0" class="empty">
          <p class="empty-text">还没有进行中的实验。选一个方向，先做 7 天。</p>
          <router-link class="btn-primary link-btn" to="/assessment">去做一次盘点</router-link>
        </div>
      </section>

      <section class="group">
        <h2 class="section-title">已完成</h2>

        <router-link
          v-for="row in doneRows"
          :key="row.experiment.id"
          class="card experiment"
          :to="`/experiment/${row.experiment.id}`"
        >
          <div class="experiment-head">
            <span class="experiment-title">{{ row.experiment.title }}</span>
            <span v-if="row.experiment.conclusion" class="conclusion" :class="conclusionClass(row.experiment.conclusion)">
              {{ row.experiment.conclusion }}
            </span>
            <StatusTag v-else :status="row.experiment.status" />
          </div>
          <p class="experiment-meta">
            {{ row.experiment.direction }} · 记录 {{ row.progress.logged }} / {{ row.progress.total }} 天
          </p>
        </router-link>

        <div v-if="doneRows.length === 0" class="empty">
          <p class="empty-text">还没有完成的实验。第一个实验做完，这里会有结论。</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listExperiments, listLogs, progressOf } from '@/api'
import type { Experiment, ExperimentConclusion, ExperimentProgress } from '@/api'
import StatusTag from '@/components/StatusTag.vue'
import LoadState from '@/components/LoadState.vue'

interface Row {
  experiment: Experiment
  progress: ExperimentProgress
  width: string
}

const experiments = ref<Experiment[]>([])
const progressMap = ref<Record<string, ExperimentProgress>>({})
const loading = ref(true)
const error = ref('')

const runningRows = computed<Row[]>(() =>
  experiments.value
    .filter((item) => item.status === 'running' || item.status === 'planned')
    .map(toRow)
)
const doneRows = computed<Row[]>(() =>
  experiments.value.filter((item) => item.status === 'done' || item.status === 'dropped').map(toRow)
)

function toRow(experiment: Experiment): Row {
  const progress = progressMap.value[experiment.id] ?? { logged: 0, total: 7, ratio: 0, complete: false }
  return { experiment, progress, width: `${Math.round(progress.ratio * 100)}%` }
}

function conclusionClass(conclusion: ExperimentConclusion): string {
  if (conclusion === '继续') return 'conclusion-continue'
  if (conclusion === '排除') return 'conclusion-drop'
  return 'conclusion-change'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    experiments.value = await listExperiments()
    const map: Record<string, ExperimentProgress> = {}
    for (const experiment of experiments.value) {
      map[experiment.id] = progressOf(await listLogs(experiment.id))
    }
    progressMap.value = map
  } catch {
    error.value = '实验数据读取失败，请重试。'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.group {
  margin-top: $space-md;
}

.experiment {
  margin-top: 12px;
  color: $color-text;
  text-decoration: none;
}

.experiment-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.experiment-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}

.experiment-meta {
  margin: 6px 0 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.bar {
  height: 6px;
  margin-top: 10px;
  border-radius: 3px;
  background-color: $color-primary-soft;
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  background-color: $color-primary;
}

.experiment-progress {
  margin: 6px 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.conclusion {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.conclusion-continue {
  background-color: rgba(21, 128, 61, 0.1);
  color: $color-success;
}

.conclusion-drop {
  background-color: rgba(185, 28, 28, 0.1);
  color: $color-danger;
}

.conclusion-change {
  background-color: rgba(180, 83, 9, 0.1);
  color: $color-warning;
}

.empty-text {
  margin: 0 0 12px;
}

.link-btn {
  text-decoration: none;
}
</style>
