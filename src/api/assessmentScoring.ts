/**
 * 测评计分与结果推导（纯函数，确定性）。
 *
 * 输入是全部作答，输出关键词、可验证方向和本周实验建议。
 * 结果页可以直接由作答重算，不依赖任何隐藏状态。
 *
 * 再次强调：这里输出的是**倾向提示**，不是诊断，也不是「你适合什么」的断言。
 */

import type { AssessmentAnswers, AssessmentType } from './types'
import type { Dimension, WorkStyle, WorkValue } from './assessmentQuestions'
import { QUESTIONS, SECTION_LABELS } from './assessmentQuestions'

export interface Direction {
  name: string
  reason: string
  experiment: {
    title: string
    hypothesis: string
  }
}

export interface ScoreResult {
  style: Record<WorkStyle, number>
  value: Record<WorkValue, number>
  /** 得分最高的行事方式；没有任何作答时为 null */
  primaryStyle: WorkStyle | null
  keywords: string[]
  directions: Direction[]
  summary: string
  /** 每个分册一句话说明，键为 assessments.type */
  sectionSummary: Record<string, string>
}

const STYLES: WorkStyle[] = ['build', 'analyze', 'people', 'express']
const VALUES: WorkValue[] = ['stability', 'growth', 'autonomy', 'impact']

const STYLE_KEYWORDS: Record<WorkStyle, string[]> = {
  build: ['偏动手', '要有看得见的成果', '喜欢即时反馈'],
  analyze: ['喜欢把问题想清楚', '对细节有耐心', '习惯先找依据'],
  people: ['靠沟通推进事情', '在意协作体验', '擅长解释和说服'],
  express: ['靠表达输出', '在意作品感', '对形式敏感'],
}

const VALUE_KEYWORDS: Record<WorkValue, string[]> = {
  stability: ['更看重确定性', '希望前路看得清'],
  growth: ['优先成长速度', '愿意为学习让路'],
  autonomy: ['在意自主权', '不喜欢被管得太细'],
  impact: ['希望事情有意义', '在意实际影响'],
}

/** 每个方向给 3 个入门级候选，配套 7 天实验 */
const DIRECTIONS: Record<WorkStyle, Direction[]> = {
  build: [
    {
      name: '后端 / 客户端开发',
      reason: '你更容易被「能跑起来的东西」吸引，开发是最快能拿到可见结果的路径。',
      experiment: {
        title: '7 天：每天写 30 分钟代码，跑通一个小功能就停',
        hypothesis: '我猜连续 7 天动手写代码之后，我会愿意继续做下去。',
      },
    },
    {
      name: '硬件 / 嵌入式',
      reason: '你愿意一遍遍调试直到跑通，这类耐心在硬件与嵌入式里是硬通货。',
      experiment: {
        title: '7 天：每天 30 分钟读一份器件手册或搭一个最小电路',
        hypothesis: '我猜接触 7 天硬件基础后，我会愿意继续折腾下去。',
      },
    },
    {
      name: '产品经理（偏实现）',
      reason: '你喜欢把东西做出来，同时能接受和人对齐需求，产品是「动手 + 沟通」的交叉点。',
      experiment: {
        title: '7 天：每天拆解一个你常用的产品，写 3 行改进建议',
        hypothesis: '我猜连续 7 天做产品拆解后，我会愿意继续做下去。',
      },
    },
  ],
  analyze: [
    {
      name: '数据分析',
      reason: '你对「在一堆信息里找规律」有耐心，数据分析是最直接的落点。',
      experiment: {
        title: '7 天：每天用一份公开数据回答一个小问题',
        hypothesis: '我猜做完 7 天数据练习后，我会对找规律这件事保持兴趣。',
      },
    },
    {
      name: '算法 / 研究',
      reason: '你更愿意先把问题想明白，研究和算法给了你「想清楚再动手」的空间。',
      experiment: {
        title: '7 天：每天 30 分钟读一个小算法或一段论文并复现',
        hypothesis: '我猜坚持 7 天复现练习后，我会愿意继续深入。',
      },
    },
    {
      name: '风控 / 审计 / 分析类岗位',
      reason: '你对依据和细节敏感，这类岗位的价值恰恰来自「把漏洞找出来」。',
      experiment: {
        title: '7 天：每天找一份公开报告，挑出 1 个你认为站不住的结论',
        hypothesis: '我猜连续 7 天做结论审查后，我会愿意继续做这件事。',
      },
    },
  ],
  people: [
    {
      name: '运营 / 增长',
      reason: '你靠和人打交道推进事情，运营能让你每天看到自己的动作带来的变化。',
      experiment: {
        title: '7 天：每天为一个账号做一个具体动作，并记录数据变化',
        hypothesis: '我猜连续 7 天做增长动作后，我会愿意继续做下去。',
      },
    },
    {
      name: '销售 / 商务拓展',
      reason: '你能接受在沟通中推进结果，销售是最快验证「我能不能靠沟通吃饭」的方向。',
      experiment: {
        title: '7 天：每天和 3 个真实的人聊一次需求（同学、社团、小商家都算）',
        hypothesis: '我猜连续 7 天做真实沟通后，我不会对这件事产生强烈排斥。',
      },
    },
    {
      name: '客户成功 / 用户支持',
      reason: '你在意协作体验，也愿意解释和说服，这类岗位的核心正是这两点。',
      experiment: {
        title: '7 天：每天回答一个陌生人的真实问题（论坛、群、客服场景都算）',
        hypothesis: '我猜做完 7 天答疑后，我会愿意继续面对人的问题。',
      },
    },
  ],
  express: [
    {
      name: '内容创作 / 新媒体',
      reason: '你靠表达输出，创作是唯一能每天拿到完整作品的路径。',
      experiment: {
        title: '7 天：每天发一条内容，哪怕只有 100 字',
        hypothesis: '我猜连续 7 天输出内容后，我会愿意继续发下去。',
      },
    },
    {
      name: '设计（视觉 / 交互）',
      reason: '你对形式敏感、在意作品感，设计能把这份敏感变成可积累的手艺。',
      experiment: {
        title: '7 天：每天临摹一张界面并写下 1 条改进',
        hypothesis: '我猜连续 7 天做设计练习后，我会愿意继续打磨。',
      },
    },
    {
      name: '视频 / 编导',
      reason: '你愿意长期打磨同一件东西，视频与编导正好需要这种耐心。',
      experiment: {
        title: '7 天：每天剪 30 秒，或写一个 30 秒的分镜',
        hypothesis: '我猜做完 7 天短片练习后，我会愿意继续做下去。',
      },
    },
  ],
}

function emptyStyle(): Record<WorkStyle, number> {
  return { build: 0, analyze: 0, people: 0, express: 0 }
}

function emptyValue(): Record<WorkValue, number> {
  return { stability: 0, growth: 0, autonomy: 0, impact: 0 }
}

/** 按维度统计作答。未知题目 / 越界选项一律忽略，不抛错。 */
export function scoreDimensions(answers: AssessmentAnswers): {
  style: Record<WorkStyle, number>
  value: Record<WorkValue, number>
} {
  const style = emptyStyle()
  const value = emptyValue()

  for (const question of QUESTIONS) {
    const choice = answers[question.id]
    if (typeof choice !== 'number') continue
    const option = question.options[choice]
    if (!option) continue
    if (STYLES.includes(option.dimension as WorkStyle)) {
      style[option.dimension as WorkStyle] += 1
    } else if (VALUES.includes(option.dimension as WorkValue)) {
      value[option.dimension as WorkValue] += 1
    }
  }

  return { style, value }
}

function ranked<T extends string>(counts: Record<T, number>): T[] {
  return (Object.keys(counts) as T[]).sort((a, b) => {
    const diff = counts[b] - counts[a]
    // 同分按固定顺序，保证结果可复现
    return diff !== 0 ? diff : a.localeCompare(b)
  })
}

export function topStyle(style: Record<WorkStyle, number>): WorkStyle {
  return ranked(style)[0]
}

/** 某个分册自己的倾向，用于分册小结 */
function sectionTopStyle(answers: AssessmentAnswers, section: string): WorkStyle | null {
  const subset: AssessmentAnswers = {}
  for (const question of QUESTIONS) {
    if (question.section === section && typeof answers[question.id] === 'number') {
      subset[question.id] = answers[question.id]
    }
  }
  if (Object.keys(subset).length === 0) return null
  const { style } = scoreDimensions(subset)
  const top = topStyle(style)
  return style[top] > 0 ? top : null
}

/**
 * 价值观分册走的是另一套维度（确定性 / 成长 / 自主 / 影响），
 * 不能复用行事方式的判断，否则该分册永远没有小结。
 */
function sectionTopValue(answers: AssessmentAnswers): WorkValue | null {
  const subset: AssessmentAnswers = {}
  for (const question of QUESTIONS) {
    if (question.section === 'values' && typeof answers[question.id] === 'number') {
      subset[question.id] = answers[question.id]
    }
  }
  if (Object.keys(subset).length === 0) return null
  const { value } = scoreDimensions(subset)
  const top = ranked(value)[0]
  return value[top] > 0 ? top : null
}

export function emptyResult(): ScoreResult {
  return {
    style: emptyStyle(),
    value: emptyValue(),
    primaryStyle: null,
    keywords: [],
    directions: [],
    summary: '',
    sectionSummary: {},
  }
}

export function scoreAll(answers: AssessmentAnswers): ScoreResult {
  if (Object.keys(answers).length === 0) return emptyResult()

  const { style, value } = scoreDimensions(answers)
  const styleRank = ranked(style).filter((dim) => style[dim] > 0)
  const valueRank = ranked(value).filter((dim) => value[dim] > 0)

  // 关键词：主行事方式给 2-3 个，主在意点给 1-2 个，合计控制在 3-5 个
  const keywords: string[] = []
  const primaryStyle = styleRank[0]
  const primaryValue = valueRank[0]

  if (primaryStyle) keywords.push(...STYLE_KEYWORDS[primaryStyle].slice(0, 3))
  if (primaryValue) keywords.push(...VALUE_KEYWORDS[primaryValue].slice(0, 2))
  const trimmed = keywords.slice(0, 5)

  // 方向：主行事方式给 2 个，第二行事方式给 1 个，合计 3 个
  const directions: Direction[] = []
  if (styleRank[0]) directions.push(DIRECTIONS[styleRank[0]][0], DIRECTIONS[styleRank[0]][1])
  if (styleRank[1]) directions.push(DIRECTIONS[styleRank[1]][0])

  const sectionSummary: Record<string, string> = {}
  for (const section of Object.keys(SECTION_LABELS)) {
    const label = SECTION_LABELS[section as keyof typeof SECTION_LABELS]
    if (section === 'values') {
      const topValue = sectionTopValue(answers)
      if (topValue) {
        sectionSummary[section] = `${label}这条线，你最在意的是「${VALUE_LABEL[topValue]}」。`
      }
      continue
    }
    const top = sectionTopStyle(answers, section)
    if (top) {
      sectionSummary[section] = `${label}这条线，你的作答偏向「${STYLE_LABEL[top]}」。`
    }
  }

  const summaryParts: string[] = []
  if (primaryStyle) {
    summaryParts.push(
      `你的作答更偏向「${STYLE_LABEL[primaryStyle]}」——${STYLE_KEYWORDS[primaryStyle][1]}。`
    )
  }
  if (primaryValue) {
    summaryParts.push(
      `在意的方向集中在「${VALUE_LABEL[primaryValue]}」，选方向时可以把它当作筛选条件。`
    )
  }

  return {
    style,
    value,
    primaryStyle: primaryStyle ?? null,
    keywords: trimmed,
    directions,
    summary: summaryParts.join(''),
    sectionSummary,
  }
}

/** 某个分册自己的关键词，用于落到 assessments.result_keywords */
export function keywordsForSection(
  answers: AssessmentAnswers,
  section: AssessmentType
): string[] {
  // 价值观分册用在意点维度，其余分册用行事方式维度
  if (section === 'values') {
    const topValue = sectionTopValue(answers)
    if (!topValue) return []
    const keywords = VALUE_KEYWORDS[topValue].slice(0, 2)
    const other = [...new Set(valuesFromAnswers(answers))].find((dim) => dim !== topValue)
    if (other) keywords.push(...VALUE_KEYWORDS[other].slice(0, 1))
    return [...new Set(keywords)].slice(0, 3)
  }

  const top = sectionTopStyle(answers, section)
  if (!top) return []

  const keywords = STYLE_KEYWORDS[top].slice(0, 2)
  const secondary = STYLE_KEYWORDS[top].slice(2, 3)

  // 该分册里还出现过别的倾向时，补一个次要关键词，让分册小结不至于太单薄
  const dimensions = new Set<Dimension>()
  for (const question of QUESTIONS) {
    if (question.section !== section) continue
    const choice = answers[question.id]
    if (typeof choice !== 'number') continue
    const option = question.options[choice]
    if (option) dimensions.add(option.dimension)
  }
  const other = [...dimensions].find((dim) => dim !== top)
  if (other) {
    const pool = STYLES.includes(other as WorkStyle)
      ? STYLE_KEYWORDS[other as WorkStyle]
      : VALUES.includes(other as WorkValue)
        ? VALUE_KEYWORDS[other as WorkValue]
        : []
    if (pool[0]) keywords.push(pool[0])
  } else {
    keywords.push(...secondary)
  }

  return [...new Set(keywords)].slice(0, 3)
}

function valuesFromAnswers(answers: AssessmentAnswers): WorkValue[] {
  const dims: WorkValue[] = []
  for (const question of QUESTIONS) {
    if (question.section !== 'values') continue
    const choice = answers[question.id]
    if (typeof choice !== 'number') continue
    const option = question.options[choice]
    if (option && VALUES.includes(option.dimension as WorkValue)) {
      dims.push(option.dimension as WorkValue)
    }
  }
  return dims
}

export const STYLE_LABEL: Record<WorkStyle, string> = {
  build: '动手做出来',
  analyze: '把问题想清楚',
  people: '和人一起推进',
  express: '用表达输出',
}

export const VALUE_LABEL: Record<WorkValue, string> = {
  stability: '确定性',
  growth: '成长速度',
  autonomy: '自主权',
  impact: '实际影响',
}

/** 每题的选项对应维度，供页面做即时反馈时使用 */
export function dimensionOf(questionId: string, optionIndex: number): Dimension | null {
  const question = QUESTIONS.find((q) => q.id === questionId)
  return question?.options[optionIndex]?.dimension ?? null
}
