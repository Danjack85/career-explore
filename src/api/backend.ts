/**
 * 数据后端选择。
 *
 * 项目当前只有 **local** 一种实现：公共数据读 src/mock，用户数据写 localStorage。
 * Supabase 的配置会被识别（见 src/utils/supabase.ts），但适配器尚未实现 ——
 * 引入 @supabase/supabase-js 不在当前任务范围内。
 *
 * 这里不静默忽略用户的配置：检测到配置时会给出一次性提示，说明数据仍走本地。
 * 各 api 模块的写入路径都用 `activeBackend()` 做分支，将来实现 Supabase 适配器时
 * 只需补上对应分支，页面无需改动。
 */

import { isSupabaseConfigured } from '@/utils/supabase'

export type Backend = 'local' | 'supabase'

let warned = false

export function activeBackend(): Backend {
  if (isSupabaseConfigured() && !warned) {
    warned = true
    console.warn(
      '[api] 检测到 Supabase 配置，但适配器尚未实现，本次仍使用本地 mock + localStorage。'
    )
  }
  return 'local'
}

/** 给设置页 / 调试用的可读描述 */
export function describeBackend(): string {
  return activeBackend() === 'local' ? '本地数据（示例数据 + 本地存储）' : 'Supabase'
}

/** Supabase 分支尚未实现时的统一报错，避免将来接错后端却静默丢数据 */
export function unsupportedBackend(scope: string): never {
  throw new Error(`[api] ${scope}：Supabase 适配器尚未实现，请先落地本地实现或补齐适配器。`)
}
