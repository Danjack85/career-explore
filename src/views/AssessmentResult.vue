<template>
  <div class="page">
    <LoadState :loading="loading" :error="error" @retry="load" />

    <div v-if="!loading && !error && !hasResult" class="empty">
      <p class="empty-text">还没有盘点结果。先花 5 分钟做一次探索盘点。</p>
      <router-link class="btn-primary link-btn" to="/assessment">开始盘点</router-link>
    </div>

    <template v-if="!loading && !error && hasResult">
      <h1 class="page-title">你的盘点结果</h1>
      <p class="page-desc">下面是关键词和几个值得验证的方向。它们只是线索，不是结论。</p>

      <section class="block">
        <h2 class="block-title">关键词</h2>
        <div class="keywords">
          <span v-for="keyword in result.keywords" :key="keyword" class="keyword">{{ keyword }}</span>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">说明</h2>
        <p class="summary">{{ result.summary }}</p>
        <ul class="section-list">
          <li v-for="(text, key) in result.sectionSummary" :key="key">{{ text }}</li>
        </ul>
      </section>

      <section class="block">
        <h2 class="block-title">值得验证的方向</h2>
        <p class="block-hint">不用现在决定。每个方向都配了一个 7 天就能做完的实验。</p>

        <article v-for="(direction, i) in result.directions" :key="direction.name" class="card direction">
          <div class="direction-head">
            <span class="direction-name">{{ direction.name }}</span>
            <span v-if="i === 0" class="badge">优先验证</span>
          </div>
          <p class="direction-reason">{{ direction.reason }}</p>
          <div class="experiment">
            <p class="experiment-title">{{ direction.experiment.title }}</p>
            <p class="experiment-hypothesis">{{ direction.experiment.hypothesis }}</p>
          </div>
          <button
            class="btn-secondary join-btn"
            type="button"
            :disabled="joining"
            @click="joinExperiment(direction)"
          >
            {{ joining ? '创建中…' : '用这个方向开始实验' }}
          </button>
        </article>
      </section>

      <p v-if="joinError" class="error">{{ joinError }}</p>

      <p class="disclaimer">
        <strong>测评不是诊断，只是探索工具。</strong>
        它只能提示你更可能在哪些事上待得住，不能判断你适合做什么。真正的答案要靠接下来两周的实验。
      </p>

      <p class="referral">
        如果最近持续失眠、情绪低落，或有过伤害自己的想法，请优先联系学校心理中心或专业医生。这份盘点帮不上忙。
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createExperiment, getLatestAssessments, scoreAll } from '@/api'
import type { AssessmentAnswers, Direction } from '@/api'
import LoadState from '@/components/LoadState.vue'

const router = useRouter()

const loading = ref(true)
const joining = ref(false)
const error = ref('')
const joinError = ref('')
const answers = ref<AssessmentAnswers>({})

const result = computed(() => scoreAll(answers.value))
const hasResult = computed(() => Object.keys(answers.value).length > 0)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const latest = await getLatestAssessments()
    const merged: AssessmentAnswers = {}
    for (const record of Object.values(latest)) {
      if (!record) continue
      Object.assign(merged, record.answers)
    }
    answers.value = merged
  } catch {
    error.value = '盘点结果读取失败，请重试。'
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function joinExperiment(direction: Direction): Promise<void> {
  if (joining.value) return
  joining.value = true
  joinError.value = ''
  try {
    const created = await createExperiment({
      title: direction.experiment.title,
      direction: direction.name,
      hypothesis: direction.experiment.hypothesis,
    })
    await router.push(`/experiment/${created.id}`)
  } catch {
    joinError.value = '创建实验失败，请稍后再试。'
    joining.value = false
  }
}
</script>

<style scoped lang="scss">
.block {
  margin-top: $space-lg;
}

.block-title {
  margin: 0 0 6px;
  font-size: $font-size-body;
  font-weight: 600;
}

.block-hint {
  margin: 0 0 10px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.keyword {
  padding: 4px 10px;
  border-radius: 6px;
  background-color: $color-primary-soft;
  color: $color-primary;
  font-size: $font-size-caption;
}

.summary {
  margin: 0;
  font-size: 14px;
}

.section-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.direction {
  margin-top: 12px;
}

.direction-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.direction-name {
  font-size: 16px;
  font-weight: 500;
}

.badge {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: $color-primary-soft;
  color: $color-primary;
  font-size: 12px;
}

.direction-reason {
  margin: 8px 0 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.experiment {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: $radius-button;
  background-color: $color-surface;
}

.experiment-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.experiment-hypothesis {
  margin: 4px 0 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.join-btn {
  width: 100%;
  margin-top: 10px;
}

.error {
  margin: $space-md 0 0;
  color: $color-danger;
  font-size: $font-size-caption;
}

.disclaimer {
  margin: $space-lg 0 0;
  padding: 12px $space-md;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-surface;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.referral {
  margin: $space-md 0 0;
  font-size: $font-size-caption;
  color: $color-warning;
}

.link-btn {
  text-decoration: none;
}
</style>
