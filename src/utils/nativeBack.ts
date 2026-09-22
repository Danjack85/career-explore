/**
 * Android 硬件返回键 / 返回手势处理。
 *
 * Capacitor 的默认行为是：**任何页面**按返回键都直接退出应用。
 * 这对多页应用是错的 —— 用户在行业详情页按返回，期望回列表，而不是被踢出应用。
 *
 * 规则：
 * - 不在首页 → 回上一个路由
 * - 在首页 → 交给系统退出（符合 Android 平台习惯）
 *
 * 仅原生平台生效，浏览器里不注册（浏览器有自己的后退按钮）。
 */

import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import type { Router } from 'vue-router'

/** 首页路由名。在这里按返回键应退出应用。 */
const ROOT_PATH = '/'

export interface BackHandlerHandle {
  remove: () => Promise<void>
}

export function registerAndroidBack(router: Router): BackHandlerHandle | null {
  if (!Capacitor.isNativePlatform()) return null

  /**
   * 有没有可回退的历史记录。
   *
   * 没有的话 router.back() 会什么都不做 —— 用户按返回键毫无反应，感觉像卡死。
   * 典型场景是从外部链接／通知直接打开某个子页面，或冷启动后第一个页面不是首页。
   */
  function canGoBack(): boolean {
    const state = router.options.history.state as { back?: string | null } | undefined
    return Boolean(state?.back)
  }

  const listener = CapacitorApp.addListener('backButton', () => {
    const path = router.currentRoute.value.path

    // 首页，或没有可回退的历史 → 退出应用（符合 Android 平台习惯）
    if (path === ROOT_PATH || !canGoBack()) {
      void CapacitorApp.exitApp()
      return
    }

    router.back()
  })

  return {
    remove: async () => {
      const handle = await listener
      await handle.remove()
    },
  }
}
