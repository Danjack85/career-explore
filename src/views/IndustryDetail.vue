<template>
  <div class="page">
    <LoadState :loading="loading" :error="error" @retry="load(props.id)" />

    <div v-if="!loading && !error && !card" class="empty">
      <p class="empty-text">没有找到这个行业，它可能已被移除。</p>
      <router-link class="btn-primary link-btn" to="/industry">回行业列表</router-link>
    </div>

    <template v-if="!loading && !error && card">
      <header class="head">
        <div class="head-row">
          <h1 class="page-title">{{ card.name }}</h1>
          <StageTag :stage="card.stage" />
        </div>
        <p class="summary">{{ card.summary }}</p>
      </header>

      <section class="block">
        <h2 class="block-title">典型岗位</h2>
        <ul class="list">
          <li v-for="job in card.jobs" :key="job">{{ job }}</li>
        </ul>
      </section>

      <section class="block">
        <h2 class="block-title">需要的技能</h2>
        <ul class="list">
          <li v-for="skill in card.skills" :key="skill">{{ skill }}</li>
        </ul>
      </section>

      <section class="block">
        <h2 class="block-title">薪资区间</h2>
        <p class="value" :class="{ unverified: card.salary_range === '待核实' }">
          {{ card.salary_range }}
        </p>
      </section>

      <section class="block">
        <h2 class="block-title">主要城市</h2>
        <ul class="list">
          <li v-for="city in card.cities" :key="city">{{ city }}</li>
        </ul>
      </section>

      <section class="block">
        <h2 class="block-title">风险点</h2>
        <ul class="list risks">
          <li v-for="risk in card.risks" :key="risk">{{ risk }}</li>
        </ul>
      </section>

      <section class="block source-block">
        <h2 class="block-title">来源与数据</h2>

        <template v-if="card.sources.length > 0">
          <p class="source-intro">
            下面是官方原文原句，未做改写。点链接可自行核验。
          </p>

          <article v-for="source in card.sources" :key="source.url" class="source-item">
            <div class="source-head">
              <span class="source-name">{{ source.name }}</span>
              <SourceLevelTag :level="source.level" />
              <span class="source-kind" :class="source.kind === 'policy' ? 'kind-policy' : 'kind-stat'">
                {{ source.kind === 'policy' ? '政策文件' : '统计数据' }}
              </span>
            </div>

            <p v-if="source.quote" class="source-quote">「{{ source.quote }}」</p>
            <p v-if="source.extra_quote" class="source-quote">「{{ source.extra_quote }}」</p>

            <p v-if="source.note" class="source-note">{{ source.note }}</p>

            <p class="source-meta">
              数据日期 {{ source.date }}
              <a class="source-link" :href="source.url" target="_blank" rel="noopener noreferrer">
                查看原文
              </a>
            </p>
          </article>
        </template>

        <p v-else class="source-missing">{{ card.source_note }}</p>

        <p v-if="card.sources.length > 0" class="source-hint">
          上面的数字是<strong>事实</strong>；本页的「阶段」「风险点」是<strong>编辑判断</strong>，
          依据上述数据但不等同于数据。判断可以不同意，数字可以自己核。
        </p>
        <p v-else class="source-hint">
          本页的「阶段」「岗位」「风险点」都是<strong>编辑判断</strong>，暂时没有可核验的官方数据支撑。
          看的时候请当作一个看问题的角度，不要当作结论。
        </p>
      </section>

      <section class="block next-step">
        <h2 class="block-title">下一步：用 7 天试一试</h2>
        <p class="next-hint">
          看完卡片还是不知道要不要往这个方向走。挑一个模板直接开始——每天 30 分钟，宿舍就能做。
        </p>

        <template v-if="industryTemplates.length > 0">
          <article v-for="t in industryTemplates" :key="t.id" class="mini-tpl">
            <p class="mini-tpl-title">{{ t.title }}</p>
            <p class="mini-tpl-suitable">适合：{{ t.suitable }}</p>
            <button
              class="btn-primary mini-start"
              type="button"
              :disabled="startingId !== null"
              @click="startFromTemplate(t)"
            >
              {{ startingId === t.id ? '创建中…' : '用这个模板开始' }}
            </button>
          </article>

          <router-link class="more-link" to="/templates">
            还有 {{ totalTemplates - industryTemplates.length }} 个其他方向的模板 →
          </router-link>
        </template>

        <template v-else>
          <button class="btn-primary next-btn" type="button" :disabled="joining" @click="startExperiment">
            {{ joining ? '创建中…' : `用「${card.name}」开始一次 7 天实验` }}
          </button>
          <router-link class="more-link" to="/templates">
            这个行业暂无专属模板，去模板库看看别的 →
          </router-link>
        </template>

        <p v-if="joinError" class="error">{{ joinError }}</p>
      </section>

      <p class="updated">卡片更新于 {{ card.updated_at }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createExperiment, getIndustry, templatesForIndustry, TEMPLATES } from '@/api'
import type { ExperimentTemplate, IndustryCard } from '@/api'
import StageTag from '@/components/StageTag.vue'
import SourceLevelTag from '@/components/SourceLevelTag.vue'
import LoadState from '@/components/LoadState.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()

const card = ref<IndustryCard | null>(null)
const loading = ref(true)
const error = ref('')
const joining = ref(false)
const joinError = ref('')
const startingId = ref<string | null>(null)

const industryTemplates = computed(() =>
  card.value ? templatesForIndustry(card.value.id).slice(0, 2) : []
)
const totalTemplates = TEMPLATES.length

function startFromTemplate(t: ExperimentTemplate): void {
  if (startingId.value) return
  startingId.value = t.id
  joinError.value = ''
  createExperiment({
    title: t.title,
    direction: t.direction,
    hypothesis: t.hypothesis,
    template_id: t.id,
  })
    .then((created) => router.push(`/experiment/${created.id}`))
    .catch(() => {
      joinError.value = '创建实验失败，请稍后再试。'
      startingId.value = null
    })
}

async function load(id: string): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    card.value = await getIndustry(id)
  } catch {
    error.value = '行业数据读取失败，请重试。'
  } finally {
    loading.value = false
  }
}

/**
 * docs/FLOW.md 里行业详情的出口是「把这个行业加进待实验清单」。
 * 这里直接落成一次 7 天实验，而不是另建一份清单 —— 所有路径都汇入实验，
 * 多一层清单只会增加一个没人维护的中间态。
 */
async function startExperiment(): Promise<void> {
  if (!card.value || joining.value) return
  joining.value = true
  joinError.value = ''
  try {
    const name = card.value.name
    const created = await createExperiment({
      title: `7 天：每天 30 分钟了解「${name}」`,
      direction: name,
      hypothesis: `我猜连续 7 天了解「${name}」之后，我会更清楚自己想不想往这个方向走。`,
    })
    await router.push(`/experiment/${created.id}`)
  } catch {
    joinError.value = '创建实验失败，请稍后再试。'
    joining.value = false
  }
}

onMounted(() => load(props.id))
watch(() => props.id, load)
</script>

<style scoped lang="scss">
.head {
  padding-bottom: $space-md;
  border-bottom: 1px solid $color-border;
}

.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.summary {
  margin: $space-sm 0 0;
  font-size: 14px;
  color: $color-text-secondary;
}

.block {
  margin-top: $space-lg;
}

.block-title {
  margin: 0 0 6px;
  font-size: $font-size-body;
  font-weight: 600;
}

.list {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  color: $color-text;
}

.list li {
  margin-bottom: 4px;
}

.risks li {
  color: $color-warning;
}

.value {
  margin: 0;
  font-size: 14px;
}

.unverified {
  color: $color-text-muted;
}

.source-block {
  padding: $space-md;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background-color: $color-surface;
}

.source-intro {
  margin: 0 0 10px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.source-item {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid $color-border;
}

.source-item:last-of-type {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: 0;
}

.source-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.source-name {
  font-size: 14px;
  font-weight: 500;
}

.source-kind {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.7;
}

.kind-stat {
  background-color: $color-success-soft;
  color: $color-success;
}

.kind-policy {
  background-color: rgba(75, 85, 99, 0.14);
  color: $color-text-secondary;
}

.source-quote {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: $color-text;
}

.source-note {
  margin: 6px 0 0;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.source-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.source-link {
  display: inline-flex;
  align-items: center;
  min-height: $control-height;
  padding-left: 12px;
  color: $color-primary;
  font-size: $font-size-caption;
  text-decoration: none;
}

.source-missing {
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed rgba(146, 64, 14, 0.4);
  border-radius: $radius-button;
  background-color: rgba(146, 64, 14, 0.05);
  color: $color-warning;
  font-size: $font-size-caption;
}

.source-hint {
  margin: 12px 0 0;
  padding-top: 10px;
  border-top: 1px solid $color-border;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.next-step {
  padding-top: $space-md;
  border-top: 1px solid $color-border;
}

.next-hint {
  margin: 0 0 12px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.mini-tpl {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-surface;
}

.mini-tpl-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
}

.mini-tpl-suitable {
  margin: 4px 0 10px;
  font-size: 12px;
  color: $color-text-secondary;
}

.mini-start {
  width: 100%;
}

.more-link {
  display: inline-flex;
  align-items: center;
  min-height: $control-height;
  font-size: $font-size-caption;
  color: $color-primary;
  text-decoration: none;
}

.next-btn {
  width: 100%;
}

.error {
  margin: $space-sm 0 0;
  font-size: $font-size-caption;
  color: $color-danger;
}

.updated {
  margin: $space-lg 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.link-btn {
  text-decoration: none;
}
</style>
