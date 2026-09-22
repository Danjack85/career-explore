/**
 * 信息雷达数据源。
 *
 * 三级降级，保证任何情况下都有内容可看：
 *   1. remote  —— 从配置的远程 feed 拉取（VITE_INFO_FEED_URL），成功则写入本地缓存
 *   2. cache   —— 上次成功拉取的缓存（未过期时直接命中，避免每次打开都请求）
 *   3. bundled —— 打包进 App 的 feed（`tools/fetch-info-feed.mjs` 生成）
 *
 * 远程 feed 是**不可信输入**：字段可能缺失、类型可能不对、枚举可能越界。
 * 所以解析时逐字段校验，非法条目直接丢弃，绝不让坏数据把页面搞崩。
 *
 * 关于「实时」的边界，见 docs/INFO_FEED.md。
 */

import bundledFeedJson from '@/mock/infoFeed.generated.json'
import type { InfoItem, SourceLevel } from './types'
import { LEAD_ONLY_SOURCE_LEVELS, TRUSTED_SOURCE_LEVELS } from './types'
import { nowISO, readOne, writeOne } from './storage'
import { isAllowedHttpUrl } from '@/utils/url'

/** feed 生成脚本的版本，与我们期望的结构对齐 */
const SUPPORTED_FEED_VERSION = 1

/** 缓存多久算新鲜。雷达是「每周 3 条」的量级，6 小时足够 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

const CACHE_KEY = 'info-feed-cache'

const ALL_LEVELS: readonly string[] = [...TRUSTED_SOURCE_LEVELS, ...LEAD_ONLY_SOURCE_LEVELS]

export type InfoSourceKind = 'remote' | 'cache' | 'bundled'

export interface InfoSnapshot {
  items: InfoItem[]
  /** 这批数据是怎么来的 */
  source: InfoSourceKind
  /** feed 的生成时间（抓取脚本运行时间），来自 feed 自身 */
  generatedAt: string | null
  /** 本地成功拉到远程的时间；来自内置 feed 时为 null */
  fetchedAt: string | null
  /** 拉取失败的原因。有兜底数据时仍会返回内容，只是带上原因供 UI 提示 */
  error: string | null
}

interface FeedCache {
  feed: unknown
  fetchedAt: string
}

// ---------- 解析与校验 ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(str).filter((s) => s.length > 0)
}

/**
 * 把任意输入解析成 InfoItem[]。
 * 标题、链接、来源三项缺一不可 —— 缺了就没有「来源可查」，这类条目不进雷达。
 */
export function parseFeed(input: unknown): { items: InfoItem[]; generatedAt: string | null } {
  if (!isRecord(input)) return { items: [], generatedAt: null }

  const version = typeof input.version === 'number' ? input.version : null
  if (version !== null && version > SUPPORTED_FEED_VERSION) {
    // 比我们认识的更新，可能字段语义已变，宁可不用
    return { items: [], generatedAt: null }
  }

  const rawItems = Array.isArray(input.items) ? input.items : []
  const items: InfoItem[] = []

  for (const raw of rawItems) {
    if (!isRecord(raw)) continue

    const title = str(raw.title)
    const url = str(raw.url)
    const sourceName = str(raw.source_name)
    const level = str(raw.source_level)

    if (!title || !url || !sourceName) continue
    if (!ALL_LEVELS.includes(level)) continue
    if (!/^https?:\/\//i.test(url)) continue

    const id = str(raw.id) || `info-${items.length}`

    items.push({
      id,
      title,
      source_name: sourceName,
      source_level: level as SourceLevel,
      url,
      published_at: str(raw.published_at) || '待核实',
      // summary / impact / action 允许为空：
      // 自动抓取只产出事实字段，判断类字段留空由用户自己写
      summary: str(raw.summary),
      impact: str(raw.impact),
      action: str(raw.action),
      tags: strArray(raw.tags),
      created_at: str(raw.created_at) || nowISO(),
    })
  }

  return { items, generatedAt: str(input.generated_at) || null }
}

const bundled = parseFeed(bundledFeedJson)

// ---------- 读取 ----------

function feedUrl(): string {
  return (import.meta.env.VITE_INFO_FEED_URL ?? '').trim()
}

/** 是否配置了远程 feed。UI 据此决定要不要显示「刷新」按钮 */
export function hasRemoteFeed(): boolean {
  return feedUrl().length > 0
}

function readCache(): FeedCache | null {
  const cached = readOne<FeedCache>(CACHE_KEY)
  if (!cached || !isRecord(cached)) return null
  return cached
}

function cachedSnapshot(cache: FeedCache): InfoSnapshot | null {
  const { items, generatedAt } = parseFeed(cache.feed)
  if (items.length === 0) return null
  return {
    items,
    source: 'cache',
    generatedAt,
    fetchedAt: cache.fetchedAt,
    error: null,
  }
}

function bundledSnapshot(): InfoSnapshot {
  return {
    items: bundled.items,
    source: 'bundled',
    generatedAt: bundled.generatedAt,
    fetchedAt: null,
    error: null,
  }
}

/** 打开页面时用：缓存新鲜就命中缓存，否则拉远程，失败再逐级降级 */
export async function loadInfoSnapshot(): Promise<InfoSnapshot> {
  const cache = readCache()
  if (cache) {
    const age = Date.now() - new Date(cache.fetchedAt).getTime()
    if (Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS) {
      const snap = cachedSnapshot(cache)
      if (snap) return snap
    }
  }
  return fetchRemote(cache)
}

/** 「刷新」按钮用：强制拉远程 */
export async function refreshInfoSnapshot(): Promise<InfoSnapshot> {
  return fetchRemote(readCache())
}

async function fetchRemote(cache: FeedCache | null): Promise<InfoSnapshot> {
  const url = feedUrl()
  if (!url) {
    // 没有配置远程源 —— 这是默认状态，不算错误
    const fallback = cache ? cachedSnapshot(cache) : null
    return fallback ?? bundledSnapshot()
  }

  // 出站地址校验：只允许 http/https，且拒绝本机、环回、私有与保留地址。
  // 当前 url 来自构建期环境变量、并非运行时可被第三方控制，所以这里不是
  // 「攻击者指定 URL」式的 SSRF；但它是 App 里唯一的对外请求，
  // 加一道校验成本极低，且能防住将来把 feed 地址改成运行时可配时的风险。
  if (!isAllowedHttpUrl(url)) {
    const fallback = cache ? cachedSnapshot(cache) : null
    const snapshot = fallback ?? bundledSnapshot()
    return {
      ...snapshot,
      error: 'feed 地址不合法（只允许公网 http/https），已改用本地数据。',
    }
  }

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json: unknown = await res.json()
    const { items, generatedAt } = parseFeed(json)

    if (items.length === 0) {
      throw new Error('feed 里没有可用条目')
    }

    const fetchedAt = nowISO()
    writeOne<FeedCache>(CACHE_KEY, { feed: json, fetchedAt })

    return { items, source: 'remote', generatedAt, fetchedAt, error: null }
  } catch (e) {
    const reason = String((e as Error)?.message ?? e).slice(0, 80)
    const fallback = cache ? cachedSnapshot(cache) : null
    const snapshot = fallback ?? bundledSnapshot()
    return { ...snapshot, error: `刷新失败（${reason}），显示的是${fallback ? '上次' : '内置'}数据` }
  }
}

/** 按 tag 过滤 */
export function filterInfoByTag(items: readonly InfoItem[], tag: string | null): InfoItem[] {
  if (!tag) return [...items]
  return items.filter((item) => item.tags.includes(tag))
}

/** 汇总所有 tag，保持出现顺序并去重 */
export function collectFeedTags(items: readonly InfoItem[]): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of items) {
    for (const tag of item.tags) {
      if (!seen.has(tag)) {
        seen.add(tag)
        tags.push(tag)
      }
    }
  }
  return tags
}

/** 从 ISO 时间算「多久以前」，给时效标注用 */
export function describeAge(iso: string | null): string {
  if (!iso) return '时间未知'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '时间未知'

  const diff = Date.now() - t
  if (diff < 0) return '刚刚'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return `${Math.floor(days / 30)} 个月前`
}

/** 超过这个天数就提示「该更新了」 */
export const STALE_AFTER_DAYS = 7

export function isStale(generatedAt: string | null): boolean {
  if (!generatedAt) return true
  const t = new Date(generatedAt).getTime()
  if (!Number.isFinite(t)) return true
  return Date.now() - t > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
}
