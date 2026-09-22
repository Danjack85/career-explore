/**
 * 信息雷达的用户批注。
 *
 * 为什么需要这个模块：
 *   自动抓取只能产出事实（标题 / 链接 / 日期）。一条信息「对你意味着什么」、
 *   「你该做什么」，是判断，不是事实 —— 机器生成它就等于编造结论，
 *   违反 docs/PRD.md 的「不伪造行业数据」。
 *
 *   但这个判断恰恰是用户自己要做的事：产品的目标是帮他找到下一步。
 *   所以这两栏留给他自己写，而不是替他写。
 *
 * 存放在本地，按 feed 条目的 id 关联。id 由 URL 派生且稳定，
 * 所以 feed 更新后，旧条目的批注不会错位到新条目上。
 */

import { nowISO, readOne, writeOne } from './storage'
import { activeBackend, unsupportedBackend } from './backend'

const KEY = 'info-notes'

export interface InfoNote {
  item_id: string
  /** 用户自己写的「这条信息对我意味着什么」 */
  impact: string
  /** 用户自己写的「我打算做什么」 */
  action: string
  updated_at: string
}

export type NoteMap = Record<string, InfoNote>

export async function listNotes(): Promise<NoteMap> {
  return readOne<NoteMap>(KEY) ?? {}
}

export async function getNote(itemId: string): Promise<InfoNote | null> {
  const all = await listNotes()
  return all[itemId] ?? null
}

export async function saveNote(
  itemId: string,
  input: { impact: string; action: string }
): Promise<InfoNote> {
  if (activeBackend() !== 'local') unsupportedBackend('saveNote')

  const all = await listNotes()
  const note: InfoNote = {
    item_id: itemId,
    impact: input.impact.trim(),
    action: input.action.trim(),
    updated_at: nowISO(),
  }

  // 两栏都清空等于删除批注，避免留下空壳
  if (!note.impact && !note.action) {
    delete all[itemId]
  } else {
    all[itemId] = note
  }

  writeOne(KEY, all)
  return note
}

export async function removeNote(itemId: string): Promise<void> {
  if (activeBackend() !== 'local') unsupportedBackend('removeNote')
  const all = await listNotes()
  delete all[itemId]
  writeOne(KEY, all)
}
