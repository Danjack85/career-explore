<template>
  <div class="page">
    <h1 class="page-title">计划</h1>
    <p class="page-desc">从上往下填。上面几层允许是猜的，越往下越要具体。</p>

    <LoadState :loading="loading" :error="error" @retry="load" />

    <template v-if="!loading && !error">
      <section v-for="field in fields" :key="field.key" class="layer">
        <label class="layer-label" :for="field.key">
          <span class="layer-name">{{ field.label }}</span>
          <span class="layer-hint">{{ field.hint }}</span>
        </label>
        <textarea
          :id="field.key"
          v-model="form[field.key]"
          class="layer-input"
          rows="2"
          :placeholder="field.placeholder"
        />
      </section>

      <div class="actions">
        <button class="btn-primary" type="button" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存计划' }}
        </button>
      </div>

      <p v-if="savedAt" class="saved">已保存 · {{ savedAtText }}</p>
      <p v-if="message" class="message">{{ message }}</p>

      <section class="next-step">
        <h2 class="section-title">下一步</h2>
        <p class="next-hint">
          本月实验是一句描述，还不是实验。把它变成一次 7 天实验，才有可回看的数据。
        </p>
        <button
          class="btn-secondary"
          type="button"
          :disabled="!canStartExperiment || starting"
          @click="startExperiment"
        >
          {{ starting ? '创建中…' : '用本月实验开始一次 7 天实验' }}
        </button>
        <p v-if="!canStartExperiment" class="next-hint">先填「本月实验」，就能在这里一键开始。</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createExperiment, getPlan, savePlan } from '@/api'
import type { Plan, PlanField } from '@/api'
import LoadState from '@/components/LoadState.vue'

const router = useRouter()

interface LayerField {
  key: PlanField
  label: string
  hint: string
  placeholder: string
}

const fields: LayerField[] = [
  {
    key: 'five_year_hypothesis',
    label: '五年方向假设',
    hint: '允许是猜的',
    placeholder: '我猜 5 年后我大概在做……',
  },
  {
    key: 'one_year_theme',
    label: '一年主题',
    hint: '一句话，别写成目标清单',
    placeholder: '今年我想把……这件事搞明白',
  },
  {
    key: 'quarter_project',
    label: '本季度项目',
    hint: '能交付出来的东西',
    placeholder: '这三个月我要做出……',
  },
  {
    key: 'month_experiment',
    label: '本月实验',
    hint: '7 天能试一次',
    placeholder: '这个月我先试……',
  },
  {
    key: 'week_action',
    label: '本周动作',
    hint: '今天就能开始的那一步',
    placeholder: '这周我要做的第一件事是……',
  },
]

const form = reactive<Record<PlanField, string>>({
  five_year_hypothesis: '',
  one_year_theme: '',
  quarter_project: '',
  month_experiment: '',
  week_action: '',
})

const loading = ref(true)
const saving = ref(false)
const starting = ref(false)
const savedAt = ref('')
const message = ref('')
const error = ref('')

const canStartExperiment = computed(() => form.month_experiment.trim().length > 0)
const savedAtText = computed(() => (savedAt.value ? savedAt.value.replace('T', ' ').slice(0, 16) : ''))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const plan = await getPlan()
    if (plan) fill(plan)
  } catch {
    error.value = '计划读取失败，请重试。'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function fill(plan: Plan): void {
  form.five_year_hypothesis = plan.five_year_hypothesis
  form.one_year_theme = plan.one_year_theme
  form.quarter_project = plan.quarter_project
  form.month_experiment = plan.month_experiment
  form.week_action = plan.week_action
  savedAt.value = plan.updated_at
}

async function save(): Promise<void> {
  saving.value = true
  message.value = ''
  const plan = await savePlan({ ...form })
  fill(plan)
  saving.value = false
  message.value = '已写入本地存储，刷新后仍在。'
}

async function startExperiment(): Promise<void> {
  if (!canStartExperiment.value || starting.value) return
  starting.value = true
  const theme = form.one_year_theme.trim()
  const created = await createExperiment({
    title: `7 天：${form.month_experiment.trim()}`,
    direction: theme || form.month_experiment.trim(),
    hypothesis: `我猜按这个方式做 7 天之后，我会更清楚要不要继续「${theme || form.month_experiment.trim()}」这个方向。`,
  })
  await router.push(`/experiment/${created.id}`)
}
</script>

<style scoped lang="scss">
.layer {
  margin-top: $space-md;
}

.layer-label {
  display: block;
  margin-bottom: 6px;
}

.layer-name {
  font-size: 14px;
  font-weight: 500;
}

.layer-hint {
  margin-left: 8px;
  font-size: 12px;
  color: $color-text-muted;
}

.layer-input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-bg;
  color: $color-text;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
}

.layer-input:focus {
  border-color: $color-primary;
  outline: none;
}

.actions {
  margin-top: $space-lg;
}

.actions .btn-primary {
  width: 100%;
}

.saved {
  margin: $space-sm 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.message {
  margin: $space-sm 0 0;
  font-size: $font-size-caption;
  color: $color-success;
}

.next-step {
  margin-top: $space-lg;
  padding-top: $space-md;
  border-top: 1px solid $color-border;
}

.next-hint {
  margin: 0 0 10px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}
</style>
