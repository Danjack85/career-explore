<template>
  <div class="page">
    <h1 class="page-title">你想先解决哪个问题？</h1>
    <p class="page-desc">选一个卡点开始，把事情拆小。</p>

    <div class="entry-list">
      <router-link v-for="entry in entries" :key="entry.path" class="card entry" :to="entry.path">
        <span class="entry-title">{{ entry.title }}</span>
        <span class="entry-desc">{{ entry.desc }}</span>
      </router-link>
    </div>

    <!-- 迷茫时最省力的入口：不用想清楚，直接抄一个跑通 -->
    <router-link class="card tpl-entry" to="/templates">
      <span class="tpl-entry-title">直接抄一个 7 天实验</span>
      <span class="tpl-entry-desc">
        {{ templateCount }} 个现成模板，每天 30 分钟，宿舍就能做。
        想不清楚的时候，先做起来再想。
      </span>
    </router-link>

    <section class="current">
      <h2 class="section-title">进行中的实验</h2>

      <router-link v-if="running" class="card running" :to="`/experiment/${running.id}`">
        <span class="running-title">{{ running.title }}</span>
        <span class="running-desc">
          第 {{ progress.logged }} / {{ progress.total }} 天已记录 · {{ running.direction }}
        </span>
        <span class="bar"><span class="bar-fill" :style="{ width: progressWidth }" /></span>
        <span class="running-action">继续记录今天 →</span>
      </router-link>

      <div v-else class="empty">
        <p class="empty-text">还没有实验。选一个方向，先做 7 天。</p>
        <router-link class="btn-primary empty-btn" to="/industry">去行业地图看看</router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listExperiments, progressOf, listLogs, TEMPLATES } from '@/api'
import type { Experiment, ExperimentProgress } from '@/api'
interface Entry {
  title: string
  desc: string
  path: string
}

// 四个卡点：A 不知道行业 / B 不知道自己适合 / C 信息太乱 / D 执行不下去
const entries: Entry[] = [
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

const running = ref<Experiment | null>(null)
const progress = ref<ExperimentProgress>({
  logged: 0,
  total: 7,
  ratio: 0,
  complete: false,
})

const templateCount = TEMPLATES.length

const progressWidth = computed(() => `${Math.round(progress.value.ratio * 100)}%`)

onMounted(async () => {
  // 首页只是入口，读失败时保持空状态即可，不打断用户
  try {
    const experiments = await listExperiments()
    const current = experiments.find((item) => item.status === 'running')
    if (!current) return
    running.value = current
    progress.value = progressOf(await listLogs(current.id))
  } catch {
    running.value = null
  }
})
</script>

<style scoped lang="scss">
.entry-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: $space-md;
}

.entry {
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

/* 模板入口：视觉上与四个卡点区分开，是另一条路径 */
.tpl-entry {
  margin-top: 12px;
  border-color: $color-primary;
  background-color: $color-primary-soft;
  color: $color-text;
  text-decoration: none;
}

.tpl-entry-title {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: $color-primary;
}

.tpl-entry-desc {
  display: block;
  margin-top: 4px;
  font-size: $font-size-caption;
  color: $color-text;
}

.current {
  margin-top: $space-lg;
}

.running {
  color: $color-text;
  text-decoration: none;
}

.running-title {
  display: block;
  font-size: 16px;
  font-weight: 500;
}

.running-desc {
  display: block;
  margin-top: 4px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
}

.bar {
  display: block;
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

.running-action {
  display: block;
  margin-top: 10px;
  font-size: $font-size-caption;
  color: $color-primary;
}

.empty-text {
  margin: 0 0 12px;
}

.empty-btn {
  text-decoration: none;
}
</style>
