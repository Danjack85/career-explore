<template>
  <div class="page assessment">
    <template v-if="!finished">
      <header class="head">
        <p class="progress-text">
          {{ SECTION_LABELS[current.section] }} · {{ indexInSection }} / {{ sectionTotal }}
        </p>
        <div class="progress" role="progressbar" :aria-valuenow="answeredCount" aria-valuemin="0" :aria-valuemax="TOTAL_QUESTIONS">
          <span class="progress-fill" :style="{ width: progressWidth }" />
        </div>
        <p class="progress-sub">共 {{ TOTAL_QUESTIONS }} 题 · 第 {{ currentIndex + 1 }} 题</p>
      </header>

      <h1 class="question">{{ current.text }}</h1>

      <div class="options">
        <button
          v-for="(option, i) in current.options"
          :key="option.text"
          class="option"
          :class="{ selected: answers[current.id] === i }"
          type="button"
          :aria-pressed="answers[current.id] === i"
          @click="choose(i)"
        >
          <span class="option-index">{{ optionLabels[i] }}</span>
          <span class="option-text">{{ option.text }}</span>
        </button>
      </div>

      <div class="actions">
        <button class="btn-secondary" type="button" :disabled="currentIndex === 0" @click="prev">
          上一题
        </button>
        <button class="btn-primary" type="button" :disabled="answers[current.id] === undefined" @click="next">
          {{ isLast ? '看结果' : '下一题' }}
        </button>
      </div>

      <p class="note">没有标准答案，选更接近你的那一个就行。</p>
    </template>

    <template v-else>
      <div class="empty">
        <p class="empty-text">正在生成盘点结果…</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  QUESTIONS,
  SECTION_LABELS,
  TOTAL_QUESTIONS,
  clearSession,
  keywordsForSection,
  questionsOf,
  readSession,
  saveAssessment,
  scoreAll,
  writeSession,
} from '@/api'
import type { AssessmentAnswers, AssessmentType } from '@/api'

const router = useRouter()

const optionLabels = ['A', 'B', 'C', 'D']

// 15 题一路填下来，中途误触返回就全丢太伤。草稿存会话级：
// 退出页面回来能接着填，应用重启则丢弃，不会把上次的答案带到下次盘点。
const DRAFT_KEY = 'assessment-draft'

interface Draft {
  answers: AssessmentAnswers
  index: number
}

const answers = reactive<AssessmentAnswers>({})
const currentIndex = ref(0)
const finished = ref(false)

const current = computed(() => QUESTIONS[currentIndex.value])
const isLast = computed(() => currentIndex.value === TOTAL_QUESTIONS - 1)
const answeredCount = computed(() => Object.keys(answers).length)
const progressWidth = computed(() => `${Math.round((answeredCount.value / TOTAL_QUESTIONS) * 100)}%`)

const sectionTotal = computed(() => questionsOf(current.value.section).length)
const indexInSection = computed(
  () => questionsOf(current.value.section).findIndex((q) => q.id === current.value.id) + 1
)

function choose(optionIndex: number): void {
  answers[current.value.id] = optionIndex
  saveDraft()
}

function prev(): void {
  if (currentIndex.value > 0) currentIndex.value -= 1
  saveDraft()
}

async function next(): Promise<void> {
  if (answers[current.value.id] === undefined) return
  if (!isLast.value) {
    currentIndex.value += 1
    saveDraft()
    return
  }
  await submit()
}

function saveDraft(): void {
  writeSession<Draft>(DRAFT_KEY, { answers: { ...answers }, index: currentIndex.value })
}

/** 恢复草稿时逐题校验，题号或选项对不上就忽略，避免旧草稿把页面带崩 */
function restoreDraft(): void {
  const draft = readSession<Draft>(DRAFT_KEY)
  if (!draft) return

  for (const [id, choice] of Object.entries(draft.answers ?? {})) {
    const question = QUESTIONS.find((item) => item.id === id)
    if (!question || typeof choice !== 'number') continue
    if (choice < 0 || choice >= question.options.length) continue
    answers[id] = choice
  }

  const index = draft.index
  if (typeof index === 'number' && index >= 0 && index < TOTAL_QUESTIONS) {
    currentIndex.value = index
  }
}

onMounted(restoreDraft)

/** 三个分册各存一条记录，与 docs/SCHEMA.md 的 assessments.type 对齐 */
async function submit(): Promise<void> {
  finished.value = true

  const snapshot: AssessmentAnswers = { ...answers }
  const result = scoreAll(snapshot)

  for (const section of Object.keys(SECTION_LABELS) as AssessmentType[]) {
    const sectionAnswers: AssessmentAnswers = {}
    for (const question of questionsOf(section)) {
      const choice = snapshot[question.id]
      if (typeof choice === 'number') sectionAnswers[question.id] = choice
    }
    if (Object.keys(sectionAnswers).length === 0) continue

    const keywords = keywordsForSection(snapshot, section)
    await saveAssessment({
      type: section,
      answers: sectionAnswers,
      result_keywords: keywords.length > 0 ? keywords : result.keywords.slice(0, 2),
      result_summary: result.sectionSummary[section] ?? result.summary,
    })
  }

  // 三个分册都已落库，先清草稿再跳转，避免下次进来看到上一次的答案
  clearSession(DRAFT_KEY)
  await router.replace('/assessment/result')
}
</script>

<style scoped lang="scss">
.assessment {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.head {
  margin-bottom: $space-lg;
}

.progress-text {
  margin: 0 0 8px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.progress {
  height: 4px;
  border-radius: 2px;
  background-color: $color-border;
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  background-color: $color-primary;
  transition: width 0.2s ease;
}

.progress-sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.question {
  margin: 0 0 $space-lg;
  font-size: $font-size-title;
  font-weight: 600;
  line-height: 1.5;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 14px $space-md;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background-color: $color-bg;
  color: $color-text;
  font-size: 14px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.option.selected {
  border-color: $color-primary;
  background-color: $color-primary-soft;
}

.option-index {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: $color-surface;
  color: $color-text-secondary;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}

.option.selected .option-index {
  background-color: $color-primary;
  color: #fff;
}

.option-text {
  flex: 1;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: $space-lg;
}

.actions .btn-secondary,
.actions .btn-primary {
  flex: 1;
}

.actions .btn-secondary:disabled,
.actions .btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.note {
  margin: $space-md 0 0;
  font-size: 12px;
  color: $color-text-muted;
  text-align: center;
}

.empty-text {
  margin: 0;
}
</style>
