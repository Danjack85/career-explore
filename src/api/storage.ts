/**
 * 本地持久化工具。
 *
 * 只服务于「无 Supabase」的降级路径：用户在本地产生的内容（测评、计划、实验）存 localStorage。
 * 公共数据（行业卡片、信息雷达）只读，直接来自 src/mock，不落本地。
 *
 * 所有读写都做兜底：隐私模式下 localStorage 可能不可用，解析失败也不能让页面白屏。
 */

const NS = 'ce:v1:'

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export function readList<T>(key: string): T[] {
  const raw = storage()?.getItem(NS + key)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function writeList<T>(key: string, list: T[]): void {
  try {
    storage()?.setItem(NS + key, JSON.stringify(list))
  } catch {
    // 写不进去（配额/隐私模式）时静默失败，调用方拿到的仍是内存里的结果
  }
}

export function readOne<T>(key: string): T | null {
  const raw = storage()?.getItem(NS + key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeOne<T>(key: string, value: T): void {
  try {
    storage()?.setItem(NS + key, JSON.stringify(value))
  } catch {
    // 同上
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(NS + key)
  } catch {
    // 同上
  }
}

// ---------- 会话级草稿 ----------
//
// 用于「填到一半的流程」：退出页面后回来能接着填，但应用重启就丢弃。
// 典型场景是 15 题的测评 —— 中途按返回不该丢答案。

function session(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}

export function readSession<T>(key: string): T | null {
  const raw = session()?.getItem(NS + key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeSession<T>(key: string, value: T): void {
  try {
    session()?.setItem(NS + key, JSON.stringify(value))
  } catch {
    // 写不进去时静默失败，不影响主流程
  }
}

export function clearSession(key: string): void {
  try {
    session()?.removeItem(NS + key)
  } catch {
    // 同上
  }
}

/** 生成 id。优先用 crypto.randomUUID，不可用时退回时间戳 + 随机串。 */export function uid(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`
    }
  } catch {
    // 忽略，走下面的兜底
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 紧凑的本地时间字符串，用于 created_at / updated_at */
export function nowISO(): string {
  return new Date().toISOString()
}

/** 把 YYYY-MM-DD 加上 n 天，返回同样格式 */
export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today(): string {
  return toDateString(new Date())
}
