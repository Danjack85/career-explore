<template>
  <div class="page">
    <LoadState :loading="loading" :error="error" @retry="refresh" />

    <div v-if="!loading && !error && !experiment" class="empty">
      <p class="empty-text">没有找到这个实验，它可能已被删除。</p>
      <router-link class="btn-primary link-btn" to="/experiment">回实验列表</router-link>
    </div>

    <template v-if="!loading && !error && experiment">
      <header class="head">
        <div class="head-row">
          <h1 class="page-title">{{ experiment.title }}</h1>
          <StatusTag :status="experiment.status" />
        </div>
        <p class="meta">
          方向：{{ experiment.direction }} · {{ experiment.start_date }} → {{ experiment.end_date }}
        </p>
      </header>

      <section class="block hypothesis">
        <h2 class="block-title">假设</h2>
        <p class="hypothesis-text">{{ experiment.hypothesis }}</p>
      </section>

      <section class="block">
        <h2 class="block-title">7 天记录 · 已记录 {{ progress.logged }} / {{ progress.total }} 天</h2>

        <div class="grid" role="group" aria-label="选择要记录的天">
          <button
            v-for="day in days"
            :key="day"
            class="day"
            :class="{ filled: energyOf(day) !== null, current: selectedDay === day }"
            type="button"
            :aria-label="`第 ${day} 天`"
            @click="selectedDay = day"
          >
            <span class="day-num">D{{ day }}</span>
            <span class="day-energy">{{ energyOf(day) ?? '—' }}</span>
          </button>
        </div>

        <div class="chart" aria-label="能量曲线">
          <span
            v-for="day in days"
            :key="day"
            class="chart-bar"
            :class="{ empty: energyOf(day) === null }"
            :style="{ height: barHeight(day) }"
            :title="`第 ${day} 天：${energyOf(day) ?? '未记录'}`"
          />
        </div>
        <p class="chart-hint">能量 1-5，指做完这件事之后的感受。</p>
      </section>

      <section class="block">
        <h2 class="block-title">记录第 {{ selectedDay }} 天</h2>

        <label class="field">
          <span class="field-label">今天做了什么</span>
          <input v-model="draft.did" class="field-input" type="text" placeholder="30 分钟，做了什么">
        </label>

        <div class="field">
          <span class="field-label">能量（1-5）</span>
          <div class="energy-picker">
            <button
              v-for="level in [1, 2, 3, 4, 5]"
              :key="level"
              class="energy-btn"
              :class="{ active: draft.energy === level }"
              type="button"
              @click="draft.energy = level"
            >
              {{ level }}
            </button>
          </div>
        </div>

        <label class="field">
          <span class="field-label">今天喜欢的瞬间</span>
          <input v-model="draft.like" class="field-input" type="text" placeholder="哪个瞬间不觉得累">
        </label>

        <label class="field">
          <span class="field-label">今天讨厌的瞬间</span>
          <input v-model="draft.dislike" class="field-input" type="text" placeholder="哪个瞬间想放弃">
        </label>

        <label class="field">
          <span class="field-label">明天要做的</span>
          <input v-model="draft.next" class="field-input" type="text" placeholder="具体一步">
        </label>

        <button class="btn-primary save-log" type="button" :disabled="saving" @click="saveCurrentDay">
          {{ saving ? '保存中…' : `保存第 ${selectedDay} 天记录` }}
        </button>
        <p v-if="logMessage" class="message">{{ logMessage }}</p>
      </section>

      <section class="block review">
        <h2 class="block-title">第 7 天复盘</h2>

        <p class="review-stats">
          已记录 {{ progress.logged }} / {{ progress.total }} 天 ·
          平均能量 {{ average === null ? '—' : average }} ·
          出现「喜欢」{{ likeDays }} 天
        </p>

        <p v-if="suggestion" class="review-suggestion" :class="suggestionClass">
          按你的记录，倾向是「{{ suggestion }}」：{{ suggestionReason }}
        </p>
        <p v-else class="review-suggestion">先记录几天，这里会给出倾向提示。</p>

        <div class="review-actions">
          <button
            v-for="option in conclusions"
            :key="option"
            class="btn-secondary review-btn"
            :class="{ active: experiment.conclusion === option }"
            type="button"
            :disabled="savingReview || progress.logged === 0"
            @click="choose(option)"
          >
            {{ option }}
          </button>
        </div>

        <p v-if="result" class="review-result" :class="resultClass">
          结论已记录：{{ experiment.conclusion }}。{{ resultText }}
        </p>
        <p v-else-if="progress.logged === 0" class="review-hint">至少记录 1 天之后才能写复盘。</p>

        <p class="drop-note">
          排除一个方向是有效结果。它帮你省下了后面几个月的时间，不是失败。
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  EXPERIMENT_DAYS,
  averageEnergy,
  daysWithLike,
  getExperiment,
  listLogs,
  progressOf,
  saveLog,
  setConclusion,
  suggestConclusion,
} from '@/api'
import type { Experiment, ExperimentConclusion, ExperimentLog } from '@/api'
import StatusTag from '@/components/StatusTag.vue'
import LoadState from '@/components/LoadState.vue'

const props = defineProps<{ id: string }>()

const days = Array.from({ length: EXPERIMENT_DAYS }, (_, i) => i + 1)
const conclusions: ExperimentConclusion[] = ['继续', '排除', '换方式']

const experiment = ref<Experiment | null>(null)
const logs = ref<ExperimentLog[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const savingReview = ref(false)
const logMessage = ref('')
const selectedDay = ref(1)

const draft = reactive({ did: '', energy: 3, like: '', dislike: '', next: '' })

const progress = computed(() => progressOf(logs.value))
const average = computed(() => averageEnergy(logs.value))
const likeDays = computed(() => daysWithLike(logs.value))
const suggestion = computed(() => suggestConclusion(logs.value))

const suggestionReason = computed(() => {
  const avg = average.value
  const likes = likeDays.value

  if (suggestion.value === '继续') return `平均能量 ${avg}，且已有 ${likes} 天出现「喜欢」。`
  if (suggestion.value === '排除') return `平均能量只有 ${avg}，「讨厌」更多指向这件事本身。`

  // 换方式有两种成因，分开说，避免出现「3.7 偏低」这种不成立的描述
  if (avg !== null && avg >= 3) {
    return `平均能量 ${avg} 不算低，但只有 ${likes} 天出现「喜欢」。把剩下的 ${
      EXPERIMENT_DAYS - progress.value.logged
    } 天记完再决定也不迟。`
  }
  return `平均能量 ${avg} 偏低，但「讨厌」更像是形式问题，可以换个方式再试一次。`
})

const suggestionClass = computed(() => {
  if (suggestion.value === '继续') return 'suggestion-continue'
  if (suggestion.value === '排除') return 'suggestion-drop'
  return 'suggestion-change'
})

const result = computed(() => experiment.value?.conclusion ?? null)

const resultClass = computed(() => {
  if (result.value === '继续') return 'result-continue'
  if (result.value === '排除') return 'result-drop'
  return 'result-change'
})

const resultText = computed(() => {
  if (result.value === '继续') return '可以把这个方向留下来，安排下一次更深的实验。'
  if (result.value === '排除') return '这个方向可以从清单里划掉了，这也是一次有效排除。'
  return '方向不定，但方式要换：改时间、改工具、改任务粒度，再做 7 天。'
})

function energyOf(day: number): number | null {
  const log = logs.value.find((item) => item.day === day)
  return log ? log.energy : null
}

function barHeight(day: number): string {
  const energy = energyOf(day)
  if (energy === null) return '4px'
  return `${Math.round((energy / 5) * 64)}px`
}

function loadDraft(day: number): void {
  const log = logs.value.find((item) => item.day === day)
  draft.did = log?.did ?? ''
  draft.energy = log?.energy ?? 3
  draft.like = log?.like ?? ''
  draft.dislike = log?.dislike ?? ''
  draft.next = log?.next ?? ''
}

async function refresh(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    experiment.value = await getExperiment(props.id)
    logs.value = await listLogs(props.id)
    const firstEmpty = days.find((day) => energyOf(day) === null)
    selectedDay.value = firstEmpty ?? 1
    loadDraft(selectedDay.value)
  } catch {
    error.value = '实验数据读取失败，请重试。'
  } finally {
    loading.value = false
  }
}

watch(selectedDay, (day) => {
  logMessage.value = ''
  loadDraft(day)
})

async function saveCurrentDay(): Promise<void> {
  saving.value = true
  logMessage.value = ''
  await saveLog(props.id, selectedDay.value, { ...draft })
  logs.value = await listLogs(props.id)
  saving.value = false
  logMessage.value = `第 ${selectedDay.value} 天已保存。`
}

async function choose(conclusion: ExperimentConclusion): Promise<void> {
  if (savingReview.value) return
  savingReview.value = true
  const updated = await setConclusion(props.id, conclusion)
  if (updated) experiment.value = updated
  savingReview.value = false
}

onMounted(async () => {
  await refresh()
  loading.value = false
})
watch(() => props.id, refresh)
</script>

<style scoped lang="scss">
.head {
  padding-bottom: $space-md;
  border-bottom: 1px solid $color-border;
}

.head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.meta {
  margin: $space-sm 0 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.block {
  margin-top: $space-lg;
}

.block-title {
  margin: 0 0 8px;
  font-size: $font-size-body;
  font-weight: 600;
}

.hypothesis {
  padding: $space-md;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background-color: $color-surface;
}

.hypothesis-text {
  margin: 0;
  font-size: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

/*
 * 窄屏下 7 列会把每格压到 44px 以下（320px 时只有 34px），
 * 而这是每天都要点的控件，值得为可点面积牺牲「7 格一行」的排布。
 * 380px 以上 7 列仍能保证每格 >= 44px，所以只在更窄时折成两行（4 + 3）。
 */
@media (max-width: 380px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  padding: 8px 0;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-bg;
  color: $color-text-secondary;
  font-family: inherit;
  cursor: pointer;
}

.day.filled {
  border-color: $color-primary;
  background-color: $color-primary-soft;
  color: $color-primary;
}

.day.current {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
}

.day-num {
  font-size: 11px;
}

.day-energy {
  font-size: 14px;
  font-weight: 500;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 72px;
  margin-top: 12px;
  padding: 0 2px;
  border-bottom: 1px solid $color-border;
}

.chart-bar {
  flex: 1;
  border-radius: 3px 3px 0 0;
  background-color: $color-primary;
}

.chart-bar.empty {
  background-color: $color-border;
}

.chart-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.field {
  display: block;
  margin-bottom: 12px;
}

.field-label {
  display: block;
  margin-bottom: 4px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.field-input {
  display: block;
  width: 100%;
  // 与按钮同高，避免输入框比按钮矮一截
  min-height: $control-height;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-bg;
  color: $color-text;
  font-size: 14px;
  font-family: inherit;
}

.field-input:focus {
  border-color: $color-primary;
  outline: none;
}

.energy-picker {
  display: flex;
  gap: 8px;
}

.energy-btn {
  flex: 1;
  min-height: $control-height;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-bg;
  color: $color-text-secondary;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}

.energy-btn.active {
  border-color: $color-primary;
  background-color: $color-primary-soft;
  color: $color-primary;
  font-weight: 500;
}

.save-log {
  width: 100%;
  margin-top: 4px;
}

.message {
  margin: $space-sm 0 0;
  font-size: $font-size-caption;
  color: $color-success;
}

.review {
  padding-top: $space-md;
  border-top: 1px solid $color-border;
}

.review-stats {
  margin: 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.review-suggestion {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: $radius-button;
  font-size: $font-size-caption;
}

.suggestion-continue {
  background-color: rgba(21, 128, 61, 0.08);
  color: $color-success;
}

.suggestion-drop {
  background-color: rgba(185, 28, 28, 0.06);
  color: $color-danger;
}

.suggestion-change {
  background-color: rgba(180, 83, 9, 0.08);
  color: $color-warning;
}

.review-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.review-btn {
  flex: 1;
}

.review-btn.active {
  border-color: $color-primary;
  background-color: $color-primary-soft;
  color: $color-primary;
  font-weight: 500;
}

.review-result {
  margin: 12px 0 0;
  font-size: $font-size-caption;
}

.result-continue {
  color: $color-success;
}

.result-drop {
  color: $color-danger;
}

.result-change {
  color: $color-warning;
}

.review-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.drop-note {
  margin: $space-md 0 0;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-surface;
  color: $color-text-secondary;
  font-size: $font-size-caption;
}

.link-btn {
  text-decoration: none;
}
</style>
