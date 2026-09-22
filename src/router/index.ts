import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 用 hash 路由：打包进 APK 后资源以相对路径加载，hash 模式不依赖服务端重写规则。
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/views/Home.vue') },
  {
    path: '/industry',
    name: 'industry-list',
    component: () => import('@/views/IndustryList.vue'),
  },
  {
    path: '/industry/:id',
    name: 'industry-detail',
    component: () => import('@/views/IndustryDetail.vue'),
    props: true,
  },
  {
    path: '/assessment',
    name: 'assessment',
    component: () => import('@/views/Assessment.vue'),
  },
  {
    path: '/assessment/result',
    name: 'assessment-result',
    component: () => import('@/views/AssessmentResult.vue'),
  },
  { path: '/info', name: 'info', component: () => import('@/views/Info.vue') },
  { path: '/plan', name: 'plan', component: () => import('@/views/Plan.vue') },
  {
    path: '/experiment',
    name: 'experiment-list',
    component: () => import('@/views/ExperimentList.vue'),
  },
  {
    path: '/experiment/:id',
    name: 'experiment-detail',
    component: () => import('@/views/ExperimentDetail.vue'),
    props: true,
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
