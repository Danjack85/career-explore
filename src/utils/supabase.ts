/**
 * Supabase client 占位。
 *
 * T02 只做占位：这里负责读取环境变量、校验配置是否合法，供数据层判断能否启用 Supabase。
 * 真实 client（@supabase/supabase-js）尚未引入 —— 引入新依赖不在 T02 范围内。
 *
 * 约束：
 * - 凭据只从环境变量读取，源码里不出现任何可用密钥。
 * - 端点地址经 isAllowedHttpUrl 校验（只允许 http/https，且拒绝本机与内网地址），
 *   该校验已抽到 src/utils/url.ts，信息雷达的远程 feed 也共用同一份。
 */

import { isAllowedHttpUrl } from './url'

export { isAllowedHttpUrl }

export interface SupabaseConfig {
  url: string
  anonKey: string
}

/** 解析出的 Supabase 配置；未配置或配置非法时为 null */
export const supabaseConfig: SupabaseConfig | null = resolveSupabaseConfig()

/**
 * 是否已完成 Supabase 配置。
 *
 * 注意：当前即使返回 true，数据层也走本地 mock —— 真正的 Supabase 适配器尚未实现。
 * 见 src/api/backend.ts 的说明。
 */
export function isSupabaseConfigured(): boolean {
  return supabaseConfig !== null
}

/**
 * 返回 Supabase client。
 * 接入 @supabase/supabase-js 后，这里改为返回真实 client 实例。
 */
export function getSupabaseClient(): never {
  if (!supabaseConfig) {
    throw new Error(
      'Supabase 未配置：请在 .env 中填写 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。'
    )
  }
  throw new Error('Supabase client 尚未接入：当前版本数据层固定走本地 mock。')
}

function resolveSupabaseConfig(): SupabaseConfig | null {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  if (!url || !anonKey) return null
  if (!isAllowedHttpUrl(url)) return null

  return { url, anonKey }
}
