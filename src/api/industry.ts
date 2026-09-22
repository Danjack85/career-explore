/**
 * 行业卡片接口。
 *
 * 数据来自两处，在 `listIndustries` / `getIndustry` 里合并：
 *   - `src/mock/industries.ts`                 编辑判断（阶段 / 岗位 / 技能 / 风险）
 *   - `src/mock/industryEvidence.generated.json` 官方统计证据（真数字 + 链接 + 日期）
 *
 * 分开存是刻意的：判断和事实生命周期不同，混在一个文件里会看着像一回事。
 * 合并后每条卡片都能回答「这个判断凭什么」——官方统计覆盖不到的行业，
 * `sources` 为空、`source_note` 说明原因，界面显式标注，不编。
 */

import { INDUSTRY_SEEDS } from '@/mock/industries'
import evidenceJson from '@/mock/industryEvidence.generated.json'
import type { IndustryCard, IndustrySource, IndustryStage, SourceLevel } from './types'

/** 列表页顶部筛选项：全部 + 五档阶段 */
export type StageFilter = IndustryStage | '全部'

interface EvidenceEntry {
  industry: string
  industry_name: string
  status: 'stat' | 'policy' | 'none'
  name?: string
  level?: string
  url?: string
  article_title?: string
  date?: string
  quote?: string | null
  extra_quote?: string | null
  note?: string
  reason?: string
}

const ALL_LEVELS: readonly string[] = [
  '官方数据',
  '招聘平台报告',
  '券商研报',
  '深度媒体',
  '从业者访谈',
  '自媒体',
]

function parseEvidence(input: unknown): Map<string, EvidenceEntry> {
  const map = new Map<string, EvidenceEntry>()
  if (typeof input !== 'object' || input === null) return map
  const list = (input as { evidence?: unknown }).evidence
  if (!Array.isArray(list)) return map

  for (const raw of list) {
    if (typeof raw !== 'object' || raw === null) continue
    const e = raw as Record<string, unknown>
    const industry = typeof e.industry === 'string' ? e.industry : ''
    const status = e.status
    if (!industry) continue
    if (status !== 'stat' && status !== 'policy' && status !== 'none') continue
    map.set(industry, e as unknown as EvidenceEntry)
  }
  return map
}

const EVIDENCE = parseEvidence(evidenceJson)

/** 把证据条目转成卡片上的来源结构；字段不全就丢弃，不让坏数据进界面 */
function toSources(entry: EvidenceEntry | undefined): IndustrySource[] {
  if (!entry || entry.status === 'none') return []
  if (!entry.name || !entry.url || !/^https?:\/\//i.test(entry.url)) return []

  const level = ALL_LEVELS.includes(entry.level ?? '')
    ? (entry.level as SourceLevel)
    : ('官方数据' as SourceLevel)

  return [
    {
      name: entry.name,
      level,
      url: entry.url,
      date: entry.date ?? '待核实',
      quote: entry.quote ?? null,
      extra_quote: entry.extra_quote ?? null,
      note: entry.note ?? '',
      kind: entry.status === 'policy' ? 'policy' : 'stat',
    },
  ]
}

function sourceNote(entry: EvidenceEntry | undefined): string {
  if (!entry) return '来源抓取尚未覆盖这个行业，待人工补充。'
  if (entry.status === 'none') {
    return entry.reason ?? '官方统计未单列该口径，来源待人工补充。'
  }
  return ''
}

function sourceDate(sources: IndustrySource[]): string {
  const dates = sources.map((s) => s.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (dates.length === 0) return '待核实'
  return dates.sort().at(-1) ?? '待核实'
}

function toCard(seed: (typeof INDUSTRY_SEEDS)[number]): IndustryCard {
  const entry = EVIDENCE.get(seed.id)
  const sources = toSources(entry)

  return {
    ...seed,
    sources,
    source_note: sourceNote(entry),
    source_date: sourceDate(sources),
  }
}

const CARDS: IndustryCard[] = INDUSTRY_SEEDS.map(toCard)

export async function listIndustries(filter: StageFilter = '全部'): Promise<IndustryCard[]> {
  const all = CARDS.map((card) => ({ ...card }))
  if (filter === '全部') return all
  return all.filter((card) => card.stage === filter)
}

export async function getIndustry(id: string): Promise<IndustryCard | null> {
  const found = CARDS.find((card) => card.id === id)
  return found ? { ...found } : null
}

/** 有多少条挂上了真实来源，用于列表页提示 */
export function sourcedCount(): { sourced: number; total: number } {
  return { sourced: CARDS.filter((c) => c.sources.length > 0).length, total: CARDS.length }
}
