/**
 * 计划接口（五层拆解）。
 *
 * 一个用户一份有效计划，整份存 localStorage。
 * 五层允许留空 —— 不知道就先空着，不强制填。
 */

import type { Plan } from './types'
import { LOCAL_USER_ID } from './types'
import { nowISO, readOne, uid, writeOne } from './storage'
import { activeBackend, unsupportedBackend } from './backend'

const KEY = 'plan'

export type PlanField =
  | 'five_year_hypothesis'
  | 'one_year_theme'
  | 'quarter_project'
  | 'month_experiment'
  | 'week_action'

export async function getPlan(): Promise<Plan | null> {
  return readOne<Plan>(KEY)
}

export async function savePlan(patch: Partial<Record<PlanField, string>>): Promise<Plan> {
  if (activeBackend() !== 'local') unsupportedBackend('savePlan')

  const current = readOne<Plan>(KEY)
  const next: Plan = {
    id: current?.id ?? uid('plan'),
    user_id: current?.user_id ?? LOCAL_USER_ID,
    five_year_hypothesis: current?.five_year_hypothesis ?? '',
    one_year_theme: current?.one_year_theme ?? '',
    quarter_project: current?.quarter_project ?? '',
    month_experiment: current?.month_experiment ?? '',
    week_action: current?.week_action ?? '',
    updated_at: nowISO(),
  }

  for (const [field, value] of Object.entries(patch)) {
    if (isPlanField(field)) next[field] = (value ?? '').trim()
  }

  writeOne(KEY, next)
  return next
}

export function isPlanField(field: string): field is PlanField {
  return (
    field === 'five_year_hypothesis' ||
    field === 'one_year_theme' ||
    field === 'quarter_project' ||
    field === 'month_experiment' ||
    field === 'week_action'
  )
}
