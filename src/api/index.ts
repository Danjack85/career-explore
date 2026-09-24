/**
 * 数据层统一出口。
 *
 * 页面只从 '@/api' 取数据，不直接 import src/mock 或 src/api/storage。
 * 将来接 Supabase 时，替换的是各模块内部实现，页面无需改动。
 */

export * from './types'
export * from './storage'
export * from './backend'
export * from './industry'
export * from './infoFeed'
export * from './infoNotes'
export * from './assessment'
export * from './assessmentQuestions'
export * from './assessmentScoring'
export * from './experimentTemplates'
export * from './plan'
export * from './experiment'
