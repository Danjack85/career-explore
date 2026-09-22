/**
 * 测评接口。
 *
 * 三个分册（兴趣 / 价值观 / 经历）各存一条记录，与 docs/SCHEMA.md 的 assessments.type 对齐。
 * 结果页需要的「方向」和「本周实验建议」由关键词推导（纯函数在 T05 实现），
 * 不额外落库，避免改数据结构。
 */

import type { Assessment, AssessmentAnswers, AssessmentType } from './types'
import { LOCAL_USER_ID } from './types'
import { nowISO, readList, uid, writeList } from './storage'

const KEY = 'assessments'

export async function listAssessments(): Promise<Assessment[]> {
  return readList<Assessment>(KEY)
}

/** 取每个分册最新的一条 */
export async function getLatestAssessments(): Promise<
  Partial<Record<AssessmentType, Assessment>>
> {
  const all = await listAssessments()
  const latest: Partial<Record<AssessmentType, Assessment>> = {}
  for (const item of all) {
    const prev = latest[item.type]
    if (!prev || item.created_at >= prev.created_at) latest[item.type] = item
  }
  return latest
}

export interface SaveAssessmentInput {
  type: AssessmentType
  answers: AssessmentAnswers
  result_keywords: string[]
  result_summary: string
}

export async function saveAssessment(input: SaveAssessmentInput): Promise<Assessment> {
  const record: Assessment = {
    id: uid('as'),
    user_id: LOCAL_USER_ID,
    type: input.type,
    answers: input.answers,
    result_keywords: [...input.result_keywords],
    result_summary: input.result_summary,
    created_at: nowISO(),
  }

  const all = readList<Assessment>(KEY)
  all.push(record)
  writeList(KEY, all)
  return record
}

export async function clearAssessments(): Promise<void> {
  writeList(KEY, [])
}
