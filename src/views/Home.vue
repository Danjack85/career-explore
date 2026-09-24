<template>
  <div class="page">
    <!--
      状态自适应主卡：首页的第一屏不是固定菜单，而是「你现在该干嘛」。
      状态优先级：该复盘 > 实验进行中 > 没做过盘点 > 推荐模板库。
      数据没加载完之前显示轻量占位，避免闪变。
    -->
    <div v-if="loading" class="hero hero-loading">
      <p class="hero-kicker">职业探索</p>
      <p class="hero-title">正在读取你的进度…</p>
    </div>

    <!-- 1) 记满 7 天没写结论：这是闭环的终点，最优先 -->
    <router-link v-else-if="needsReview && running" class="hero hero-review" :to="`/experiment/${running.id}`">
      <p class="hero-kicker">7 天记录已经完成</p>
      <p class="hero-title">{{ running.title }}</p>
      <p class="hero-text">
        往下写你的结论：继续、排除、还是换方式。排除一个方向也是有效结果。
      </p>
      <span class="hero-action">去写复盘 →</span>
    </router-link>

    <!-- 2) 实验进行中：今天该做什么，直接摆出来 -->
    <router-link v-else-if="running" class="hero hero-running" :to="`/experiment/${running.id}`">
      <p class="hero-kicker">
        实验进行中 · 已记录 {{ progress.logged }} / {{ progress.total }} 天
      </p>
      <p class="hero-title">{{ running.title }}</p>
      <p v-if="todayTask" class="hero-text">
        <span class="hero-task-label">今日建议</span>
        {{ todayTask }}
      </p>
      <p v-else class="hero-text">今天还没记录。花 30 分钟做一点，写下能量和感受。</p>
      <span class="bar"><span class="bar-fill" :style="{ width: progressWidth }" /></span>
      <span class="hero-action">记录今天 →</span>
    </router-link>

    <!-- 3) 没做过盘点：先认识自己 -->
    <router-link v-else-if="!hasAssessment" class="hero hero-start" to="/assessment">
      <p class="hero-kicker">第一次来</p>
      <p class="hero-title">先花 5 分钟认识一下自己</p>
      <p class="hero-text">
        15 道轻问题，给你几个关键词和值得验证的方向。不是诊断，只是线索。
      </p>
      <span class="hero-action">开始盘点 →</span>
    </router-link>

    <!-- 4) 其他情况：推荐直接抄一个模板 -->
    <router-link v-else class="hero hero-templates" to="/templates">
      <p class="hero-kicker">不知道从哪开始？</p>
      <p class="hero-title">直接抄一个 7 天实验</p>
      <p class="hero-text">
        {{ templateCount }} 个现成模板，每天 30 分钟，宿舍就能做。先做起来，再想清楚。
      </p>
      <span class="hero-action">去模板库挑一个 →</span>
    </router-link>

    <!-- 四个卡点入口：从问题出发的经典路径，排在主卡之后 -->
    <section class="entries">
      <h2 class="section-title">或者，从你的卡点入手</h2>
      <router-link v-for="entry in entries" :key="entry.path" class="card entry" :to="entry.path">
        <span class="entry-title">{{ entry.title }}</span>
        <span class="entry-desc">{{ entry.desc }}</span>
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getLatestAssessments,
  getTemplate,
  listExperiments,
  listLogs,
  progressOf,
  TEMPLATES,
} from '@/api'
import type { Experiment, ExperimentProgress } from '@/api'

const entries = [
  {
    title: '不知道有哪些行业',
    desc: '看行业地图：阶段、岗位、技能、风险、来源',
    path: '/industry',
  },
  {
    title: '不知道自己适合什么',
    desc: '做一次探索盘点，拿到关键词和可验证的方向',
    path: '/assessment',
  },
  {
    title: '信息太乱、看不完',
    desc: '看信息雷达：每周 3 条，标来源等级和行动点',
    path: '/info',
  },
  {
    title: '有方向但执行不下去',
    desc: '把方向拆成本月实验和本周动作',
    path: '/plan',
  },
]

const loading = ref(true)
const hasAssessment = ref(false)
const running = ref<Experiment | null>(null)
const progress = ref<ExperimentProgress>({ logged: 0, total: 7, ratio: 0, complete: false })
/** 进行中实验今天（下一个未记录的天）的建议任务，来自模板 */
const todayTask = ref<string | null>(null)

const templateCount = TEMPLATES.length
const progressWidth = computed(() => `${Math.round(progress.value.ratio * 100)}%`)

/** 记满 7 天且没写结论 —— 首页第一优先级是把人送回复盘 */
const needsReview = computed(
  () => progress.value.complete && (running.value?.conclusion ?? null) === null
)

onMounted(async () => {
  // 首页是入口，读失败时保持空状态即可，不打断用户
  try {
    const assessments = await getLatestAssessments()
    hasAssessment.value = Object.keys(assessments).length > 0

    const experiments = await listExperiments()
    const current = experiments.find((item) => item.status === 'running')
    if (current) {
      running.value = current
      const logs = await listLogs(current.id)
      progress.value = progressOf(logs)

      // 今日建议任务 = 模板清单里「下一个未记录的天」对应那条
      const template = current.template_id ? getTemplate(current.template_id) : null
      if (template) {
        const loggedDays = new Set(logs.map((log) => log.day))
        const nextDay = Array.from({ length: progress.value.total }, (_, i) => i + 1).find(
          (day) => !loggedDays.has(day)
        )
        todayTask.value = nextDay ? (template.days[nextDay - 1] ?? null) : null
      }
    }
  } catch {
    running.value = null
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
/* 主卡：四种状态共用骨架，配色按语义区分 */
.hero {
  display: block;
  padding: $space-md;
  border-radius: $radius-card;
  text-decoration: none;
}

.hero-loading {
  border: 1px solid $color-border;
  background-color: $color-surface;
}

.hero-running,
.hero-templates {
  border: 1px solid $color-primary;
  background-color: $color-primary-soft;
}

.hero-review {
  border: 1px solid $color-warning;
  background-color: $color-warning-soft;
}

.hero-start {
  border: 1px solid $color-border;
  background-color: $color-surface;
}

.hero-kicker {
  margin: 0;
  font-size: 12px;
  color: $color-text-secondary;
}

.hero-review .hero-kicker {
  color: $color-warning;
}

.hero-running .hero-kicker,
.hero-templates .hero-kicker {
  color: $color-primary;
}

.hero-title {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: $color-text;
}

.hero-text {
  display: block;
  margin: 8px 0 0;
  font-size: $font-size-caption;
  line-height: 1.7;
  color: $color-text;
}

.hero-task-label {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: $color-bg;
  color: $color-primary;
  font-size: 11px;
}

.hero-action {
  display: inline-block;
  margin-top: 10px;
  font-size: $font-size-caption;
  font-weight: 500;
  color: $color-primary;
}

.hero-review .hero-action {
  color: $color-warning;
}

.bar {
  display: block;
  height: 6px;
  margin-top: 10px;
  border-radius: 3px;
  background-color: $color-bg;
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  background-color: $color-primary;
}

/* 卡点入口区 */
.entries {
  margin-top: $space-lg;
}

.entry-list,
.entry {
  display: block;
}

.entry {
  margin-bottom: 12px;
  color: $color-text;
  text-decoration: none;
}

.entry-title {
  display: block;
  font-size: 16px;
  font-weight: 500;
}

.entry-desc {
  display: block;
  margin-top: 4px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}
</style>
