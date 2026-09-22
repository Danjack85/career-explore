/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 项目地址，见 .env.example。留空则数据层走本地 mock（T02） */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase 公开密钥（anon key），权限由数据库 RLS 策略控制 */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /**
   * 信息雷达的远程 feed 地址。
   * 留空时用随 App 打包的 feed（src/mock/infoFeed.generated.json），点「刷新」不联网。
   * 见 docs/INFO_FEED.md。
   */
  readonly VITE_INFO_FEED_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
