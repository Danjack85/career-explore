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

      <!--
        记录满 7 天时把「该复盘了」提到最前面。
        复盘区在页面下方，用户记完第 7 天通常停在记录表单那里，不往下滚就看不到 ——
        而复盘是这个闭环的终点（FLOW.md：第 7 天复盘 → 继续/排除/换方式）。
        文案刻意平实：不催、不夸、不加动效（docs/DESIGN.md：不制造焦虑、不游戏化）。
      -->
      <div v-if="needsReview" class="review-nudge">
        <p class="nudge-title">7 天记录已经完成了</p>
        <p class="nudge-text">
          往下看「第 7 天复盘」，写下你的结论：继续、排除、还是换个方式。
          排除一个方向也是有效结果。
        </p>
      </div>

      <section class="block hypothesis">
        <div class="block-head">
          <h2 class="block-title">假设</h2>
          <button v-if="!editing" class="link-btn" type="button" @click="startEdit">修改</button>
        </div>

        <template v-if="!editing">
          <p class="hypothesis-text">{{ experiment.hypothesis }}</p>
        </template>

        <form v-else class="edit-form" @submit.prevent="saveEdit">
          <label class="field">
            <span class="field-label">实验标题</span>
            <input v-model="edit.title" class="field-input" type="text" placeholder="这次实验叫什么">
          </label>
          <label class="field">
            <span class="field-label">假设（要能被证伪）</span>
            <textarea
              v-model="edit.hypothesis"
              class="field-input"
              rows="3"
              placeholder="我猜……做了……之后，我会……"
            />
          </label>
          <p class="edit-hint">
            假设写错了不用重开实验 —— 做到一半改了想法，就把新想法写进来，复盘时看的是最新这版。
          </p>
          <div class="edit-actions">
            <button class="btn-secondary" type="button" :disabled="savingEdit" @click="cancelEdit">
              取消
            </button>
            <button class="btn-primary" type="submit" :disabled="savingEdit || !canSaveEdit">
              {{ savingEdit ? '保存中…' : '保存' }}
            </button>
          </div>
        </form>
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

      <section class="block danger-zone">
        <template v-if="!confirmingDelete">
          <button class="link-danger" type="button" @click="confirmingDelete = true">
            删除这个实验
          </button>
        </template>

        <div v-else class="confirm">
          <p class="confirm-text">
            <template v-if="progress.logged > 0">
              删除后，这个实验和它的
              <strong>{{ progress.logged }} 天记录</strong>
              都会一起消失，无法恢复。
            </template>
            <template v-else>
              删除后，这个实验会消失，无法恢复。（还没记过日志）
            </template>
          </p>
          <p class="confirm-hint">
            如果只是不想继续，用上面的复盘写「排除」更合适 —— 那会保留记录，
            以后回头看能得到信息。
          </p>
          <div class="confirm-actions">
            <button class="btn-secondary" type="button" :disabled="deleting" @click="confirmingDelete = false">
              取消
            </button>
            <button class="btn-danger" type="button" :disabled="deleting" @click="doDelete">
              {{ deleting ? '删除中…' : '确认删除' }}
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  EXPERIMENT_DAYS,
  averageEnergy,
  daysWithLike,
  getExperiment,
  listLogs,
  progressOf,
  removeExperiment,
  saveLog,
  setConclusion,
  suggestConclusion,
  updateExperiment,
} from '@/api'
import type { Experiment, ExperimentConclusion, ExperimentLog } from '@/api'
import StatusTag from '@/components/StatusTag.vue'
import LoadState from '@/components/LoadState.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()

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

// 编辑与删除
const editing = ref(false)
const savingEdit = ref(false)
const confirmingDelete = ref(false)
const deleting = ref(false)
const edit = reactive({ title: '', hypothesis: '' })

/** 标题和假设都不能为空 —— 空标题的卡片在列表里没法辨认 */
const canSaveEdit = computed(
  () => edit.title.trim().length > 0 && edit.hypothesis.trim().length > 0
)

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

/** 记录满 7 天且还没写结论 —— 此时提示用户去复盘，把闭环闭上 */
const needsReview = computed(
  () => progress.value.complete && (experiment.value?.conclusion ?? null) === null
)

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

function startEdit(): void {
  if (!experiment.value) return
  edit.title = experiment.value.title
  edit.hypothesis = experiment.value.hypothesis
  editing.value = true
}

function cancelEdit(): void {
  editing.value = false
}

async function saveEdit(): Promise<void> {
  if (!canSaveEdit.value || savingEdit.value) return
  savingEdit.value = true
  try {
    const updated = await updateExperiment(props.id, {
      title: edit.title.trim(),
      hypothesis: edit.hypothesis.trim(),
    })
    if (updated) experiment.value = updated
    editing.value = false
  } finally {
    savingEdit.value = false
  }
}

async function doDelete(): Promise<void> {
  if (deleting.value) return
  deleting.value = true
  try {
    await removeExperiment(props.id)
    await router.replace('/experiment')
  } catch {
    deleting.value = false
    confirmingDelete.value = false
  }
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

/* 完成 7 天后的复盘提示：用主色浅底，不用警示色 —— 这是提醒，不是警告 */
.review-nudge {
  margin-top: $space-md;
  padding: 12px $space-md;
  border: 1px solid $color-primary;
  border-radius: $radius-card;
  background-color: $color-primary-soft;
}

.nudge-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: $color-primary;
}

.nudge-text {
  margin: 4px 0 0;
  font-size: $font-size-caption;
  color: $color-text;
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

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.hypothesis-text {
  margin: 0;
  font-size: 14px;
}

.link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: $color-primary;
  font-size: $font-size-caption;
  font-family: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.edit-form {
  margin-top: 8px;
}

.edit-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: $color-text-secondary;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.edit-actions .btn-secondary,
.edit-actions .btn-primary,
.confirm-actions .btn-secondary,
.confirm-actions .btn-danger {
  flex: 1;
}

/* 破坏性动作单独成区，与常规操作拉开距离，避免误触 */
.danger-zone {
  margin-top: $space-lg;
  padding-top: $space-md;
  border-top: 1px solid $color-border;
}

.link-danger {
  padding: 0;
  border: 0;
  background: none;
  color: $color-danger;
  font-size: $font-size-caption;
  font-family: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.confirm {
  padding: 12px;
  border: 1px solid rgba(185, 28, 28, 0.3);
  border-radius: $radius-button;
  background-color: rgba(185, 28, 28, 0.04);
}
.confirm-text {
  margin: 0;
  font-size: $font-size-caption;
  color: $color-text;
}

.confirm-hint {
  margin: 8px 0 12px;
  font-size: 12px;
  color: $color-text-secondary;
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: $control-height;
  padding: 0 $space-md;
  border: 0;
  border-radius: $radius-button;
  background-color: $color-danger;
  color: #fff;
  font-size: $font-size-body;
  font-family: inherit;
  cursor: pointer;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  background-color: rgba(22, 101, 52, 0.08);
  color: $color-success;
}

.suggestion-drop {
  background-color: rgba(185, 28, 28, 0.06);
  color: $color-danger;
}

.suggestion-change {
  background-color: rgba(146, 64, 14, 0.08);
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
