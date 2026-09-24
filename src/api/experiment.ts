/**
 * 实验接口（实验主表 + 每日记录）。
 *
 * 一个实验 = 一次 7 天的低成本试错。每天记录能量与喜恶，第 7 天复盘。
 * 结论推导规则来自 docs/FLOW.md 的「最小可观察信号」，在下方以纯函数实现，供页面复用。
 */

import type { Experiment, ExperimentConclusion, ExperimentLog, ExperimentStatus } from './types'
import { EXPERIMENT_DAYS, LOCAL_USER_ID } from './types'
import { addDays, nowISO, readList, today, uid, writeList } from './storage'
import { activeBackend, unsupportedBackend } from './backend'

const EXP_KEY = 'experiments'
const LOG_KEY = 'logs'

// ---------- 实验主表 ----------

/** 旧数据没有 template_id 字段，读取时归一化，避免 undefined 渗进视图 */
function normalize(e: Experiment): Experiment {
  return { ...e, template_id: e.template_id ?? null }
}

export async function listExperiments(): Promise<Experiment[]> {
  const all = readList<Experiment>(EXP_KEY)
  return all
    .map(normalize)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  const all = readList<Experiment>(EXP_KEY)
  const found = all.find((item) => item.id === id)
  return found ? normalize(found) : null
}

export interface CreateExperimentInput {
  title: string
  direction: string
  hypothesis: string
  /** 默认今天 */
  start_date?: string
  /** 从模板创建时带上模板 id；手动创建不用传 */
  template_id?: string
}

export async function createExperiment(input: CreateExperimentInput): Promise<Experiment> {
  if (activeBackend() !== 'local') unsupportedBackend('createExperiment')

  const start = input.start_date ?? today()
  const record: Experiment = {
    id: uid('exp'),
    user_id: LOCAL_USER_ID,
    title: input.title.trim(),
    direction: input.direction.trim(),
    hypothesis: input.hypothesis.trim(),
    start_date: start,
    end_date: addDays(start, EXPERIMENT_DAYS - 1),
    status: 'running',
    conclusion: null,
    template_id: input.template_id?.trim() || null,
    created_at: nowISO(),
  }

  const all = readList<Experiment>(EXP_KEY)
  all.push(record)
  writeList(EXP_KEY, all)
  return record
}

export async function updateExperiment(
  id: string,
  patch: Partial<
    Pick<Experiment, 'title' | 'direction' | 'hypothesis' | 'status' | 'start_date' | 'end_date'>
  >
): Promise<Experiment | null> {
  if (activeBackend() !== 'local') unsupportedBackend('updateExperiment')

  const all = readList<Experiment>(EXP_KEY)
  const index = all.findIndex((item) => item.id === id)
  if (index === -1) return null

  const base = all[index]
  // 逐字段取值，避免 patch 里显式的 undefined 覆盖已有内容
  const startDate = patch.start_date ?? base.start_date
  const next: Experiment = {
    ...base,
    title: patch.title ?? base.title,
    direction: patch.direction ?? base.direction,
    hypothesis: patch.hypothesis ?? base.hypothesis,
    status: patch.status ?? base.status,
    start_date: startDate,
    end_date: addDays(startDate, EXPERIMENT_DAYS - 1),
  }

  all[index] = next
  writeList(EXP_KEY, all)
  return next
}

/**
 * 写下第 7 天的复盘结论，并同步状态：
 * - 继续 → done（这次实验做完了，方向留下）
 * - 换方式 → done（方向不定，换形式再做一次）
 * - 排除 → dropped（方向排除，这也是有效结果）
 */
export async function setConclusion(
  id: string,
  conclusion: ExperimentConclusion
): Promise<Experiment | null> {
  if (activeBackend() !== 'local') unsupportedBackend('setConclusion')

  const all = readList<Experiment>(EXP_KEY)
  const index = all.findIndex((item) => item.id === id)
  if (index === -1) return null

  const status: ExperimentStatus = conclusion === '排除' ? 'dropped' : 'done'
  all[index] = { ...all[index], conclusion, status }
  writeList(EXP_KEY, all)
  return all[index]
}

export async function removeExperiment(id: string): Promise<void> {
  if (activeBackend() !== 'local') unsupportedBackend('removeExperiment')

  writeList(
    EXP_KEY,
    readList<Experiment>(EXP_KEY).filter((item) => item.id !== id)
  )
  writeList(
    LOG_KEY,
    readList<ExperimentLog>(LOG_KEY).filter((log) => log.experiment_id !== id)
  )
}

// ---------- 每日记录 ----------

export async function listLogs(experimentId: string): Promise<ExperimentLog[]> {
  return readList<ExperimentLog>(LOG_KEY)
    .filter((log) => log.experiment_id === experimentId)
    .sort((a, b) => a.day - b.day)
}

export interface SaveLogInput {
  did: string
  energy: number
  like: string
  dislike: string
  next: string
}

/** 同一实验同一天只保留一条，重复保存即覆盖 */
export async function saveLog(
  experimentId: string,
  day: number,
  input: SaveLogInput
): Promise<ExperimentLog> {
  if (activeBackend() !== 'local') unsupportedBackend('saveLog')

  const all = readList<ExperimentLog>(LOG_KEY)
  const index = all.findIndex((log) => log.experiment_id === experimentId && log.day === day)

  const record: ExperimentLog = {
    id: index === -1 ? uid('log') : all[index].id,
    experiment_id: experimentId,
    day,
    did: input.did.trim(),
    energy: clampEnergy(input.energy),
    like: input.like.trim(),
    dislike: input.dislike.trim(),
    next: input.next.trim(),
    created_at: index === -1 ? nowISO() : all[index].created_at,
  }

  if (index === -1) all.push(record)
  else all[index] = record

  writeList(LOG_KEY, all)
  return record
}

export function clampEnergy(value: number): number {
  if (!Number.isFinite(value)) return 3
  return Math.min(5, Math.max(1, Math.round(value)))
}

// ---------- 纯函数：结论推导与进度（供页面复用） ----------

export function averageEnergy(logs: readonly ExperimentLog[]): number | null {
  if (logs.length === 0) return null
  const sum = logs.reduce((acc, log) => acc + log.energy, 0)
  return Math.round((sum / logs.length) * 10) / 10
}

/** 有几天出现了「喜」，用于判断是否满足「继续」的条件之一 */
export function daysWithLike(logs: readonly ExperimentLog[]): number {
  return logs.filter((log) => log.like.trim().length > 0).length
}

/**
 * 按 docs/FLOW.md 的最小可观察信号给出建议。
 * 方向错误和方式错误的区分依据是「厌」集中在事情本身还是形式。
 * 这里只做提示，最终结论由用户自己选。
 */
export function suggestConclusion(logs: readonly ExperimentLog[]): ExperimentConclusion | null {
  if (logs.length === 0) return null

  const avg = averageEnergy(logs)
  if (avg === null) return null

  const hasLike = logs.filter((log) => log.like.trim().length > 0).length >= 3
  if (avg >= 3 && hasLike) return '继续'

  const allDislikeLow = logs.every((log) => log.dislike.trim().length === 0)
  if (!allDislikeLow && avg <= 2) return '排除'

  return '换方式'
}

export interface ExperimentProgress {
  /** 已记录天数 */
  logged: number
  /** 总天数，固定 7 */
  total: number
  /** 0-1 */
  ratio: number
  /** 是否已记录满 7 天 */
  complete: boolean
}

export function progressOf(logs: readonly ExperimentLog[]): ExperimentProgress {
  const logged = new Set(logs.map((log) => log.day)).size
  return {
    logged,
    total: EXPERIMENT_DAYS,
    ratio: Math.min(1, logged / EXPERIMENT_DAYS),
    complete: logged >= EXPERIMENT_DAYS,
  }
}
