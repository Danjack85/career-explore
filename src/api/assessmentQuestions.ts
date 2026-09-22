/**
 * 测评题目（自研，不抄袭任何官方量表）。
 *
 * 三个分册与 docs/SCHEMA.md 的 assessments.type 对应：
 * - interest   兴趣      6 题：你更容易被什么吸引
 * - values     价值观    6 题：你在意工作的什么
 * - experience 经历能量  3 题：回想「做着不觉得累」的时刻
 *
 * 每题 4 个选项，每个选项挂一个倾向维度：
 * - 兴趣 / 经历 题 → WorkStyle（偏行事方式）
 * - 价值观 题   → WorkValue（偏在意的东西）
 *
 * 题目只说「你更容易……」，不做任何「你是 X 型人格」的判断。
 */

import type { AssessmentType } from './types'

/** 行事方式倾向 */
export type WorkStyle = 'build' | 'analyze' | 'people' | 'express'

/** 在意的方向 */
export type WorkValue = 'stability' | 'growth' | 'autonomy' | 'impact'

export type Dimension = WorkStyle | WorkValue

export interface QuestionOption {
  text: string
  dimension: Dimension
}

export interface Question {
  id: string
  section: AssessmentType
  text: string
  options: QuestionOption[]
}

export const SECTION_LABELS: Record<AssessmentType, string> = {
  interest: '兴趣',
  values: '价值观',
  experience: '经历能量',
}

export const SECTION_ORDER: readonly AssessmentType[] = ['interest', 'values', 'experience']

export const QUESTIONS: Question[] = [
  // ---------- 兴趣（6） ----------
  {
    id: 'i1',
    section: 'interest',
    text: '空出一整个下午，你更可能做什么？',
    options: [
      { text: '拆点、装点、修点什么', dimension: 'build' },
      { text: '把一堆信息理清楚', dimension: 'analyze' },
      { text: '找人聊、攒个局', dimension: 'people' },
      { text: '写点、画点、剪点什么', dimension: 'express' },
    ],
  },
  {
    id: 'i2',
    section: 'interest',
    text: '下面哪种「难」你更能忍？',
    options: [
      { text: '一遍遍调试，直到它跑通', dimension: 'build' },
      { text: '在一堆数据里找不到规律', dimension: 'analyze' },
      { text: '说服一个不认同你的人', dimension: 'people' },
      { text: '作品被人当面挑毛病', dimension: 'express' },
    ],
  },
  {
    id: 'i3',
    section: 'interest',
    text: '你更容易被什么吸引？',
    options: [
      { text: '一个能立刻上手的工具', dimension: 'build' },
      { text: '一个还没想明白的问题', dimension: 'analyze' },
      { text: '一群人的状态在变化', dimension: 'people' },
      { text: '一种具体的表达形式', dimension: 'express' },
    ],
  },
  {
    id: 'i4',
    section: 'interest',
    text: '学一个新东西时，你先做什么？',
    options: [
      { text: '直接打开软件试一试', dimension: 'build' },
      { text: '先找系统性的资料搭框架', dimension: 'analyze' },
      { text: '找人问、找人带', dimension: 'people' },
      { text: '先临摹一个范本', dimension: 'express' },
    ],
  },
  {
    id: 'i5',
    section: 'interest',
    text: '做完哪件事，你更想拿给别人看？',
    options: [
      { text: '一个能用的东西', dimension: 'build' },
      { text: '一份说得通的结论', dimension: 'analyze' },
      { text: '一次把事情推动的变化', dimension: 'people' },
      { text: '一件完整的作品', dimension: 'express' },
    ],
  },
  {
    id: 'i6',
    section: 'interest',
    text: '你更能接受哪种工作节奏？',
    options: [
      { text: '目标清楚，但有不少重复', dimension: 'build' },
      { text: '变量多，方向要自己找', dimension: 'analyze' },
      { text: '高频和人打交道', dimension: 'people' },
      { text: '长期打磨同一件东西', dimension: 'express' },
    ],
  },

  // ---------- 价值观（6） ----------
  {
    id: 'v1',
    section: 'values',
    text: '一份工作里，你最不能忍的是？',
    options: [
      { text: '看不到稳定的前景', dimension: 'stability' },
      { text: '学不到新东西', dimension: 'growth' },
      { text: '没有自主决定的余地', dimension: 'autonomy' },
      { text: '做的事没有实际影响', dimension: 'impact' },
    ],
  },
  {
    id: 'v2',
    section: 'values',
    text: '选方向时，你更在意哪一点？',
    options: [
      { text: '确定性：知道三年后大概在哪', dimension: 'stability' },
      { text: '成长速度：一年能抵两年', dimension: 'growth' },
      { text: '自由度：能按自己的节奏来', dimension: 'autonomy' },
      { text: '影响力：做的事有人受益', dimension: 'impact' },
    ],
  },
  {
    id: 'v3',
    section: 'values',
    text: '两个机会只能选一个，你选？',
    options: [
      { text: '稳定但平淡', dimension: 'stability' },
      { text: '波动但天花板高', dimension: 'growth' },
      { text: '收入一般但我说了算', dimension: 'autonomy' },
      { text: '辛苦但看得见价值', dimension: 'impact' },
    ],
  },
  {
    id: 'v4',
    section: 'values',
    text: '你怎么定义「这件事做得好」？',
    options: [
      { text: '按计划完成，不出岔子', dimension: 'stability' },
      { text: '比上个月的我强', dimension: 'growth' },
      { text: '是按我的判断做出来的', dimension: 'autonomy' },
      { text: '确实帮到了具体的人', dimension: 'impact' },
    ],
  },
  {
    id: 'v5',
    section: 'values',
    text: '什么情况下你愿意多花时间？',
    options: [
      { text: '一次性把问题彻底收尾', dimension: 'stability' },
      { text: '能学到以后用得上的东西', dimension: 'growth' },
      { text: '我自己想把它做完', dimension: 'autonomy' },
      { text: '团队里没人能顶上', dimension: 'impact' },
    ],
  },
  {
    id: 'v6',
    section: 'values',
    text: '你更怕哪一种？',
    options: [
      { text: '原地踏步，还看不清前路', dimension: 'stability' },
      { text: '三年后和现在没差别', dimension: 'growth' },
      { text: '被人盯得很细', dimension: 'autonomy' },
      { text: '忙了一年，什么都没改变', dimension: 'impact' },
    ],
  },

  // ---------- 经历能量（3） ----------
  {
    id: 'e1',
    section: 'experience',
    text: '上一次忘记看时间，是在做什么？',
    options: [
      { text: '折腾一个东西，直到它能用', dimension: 'build' },
      { text: '查资料，想搞明白一个问题', dimension: 'analyze' },
      { text: '和人聊一件你在意的事', dimension: 'people' },
      { text: '写、画、剪点什么出来', dimension: 'express' },
    ],
  },
  {
    id: 'e2',
    section: 'experience',
    text: '别人夸你哪一点时，你比较受用？',
    options: [
      { text: '你做的东西真好用', dimension: 'build' },
      { text: '你想得真清楚', dimension: 'analyze' },
      { text: '跟你一起做事很舒服', dimension: 'people' },
      { text: '你做的东西真好看 / 好读', dimension: 'express' },
    ],
  },
  {
    id: 'e3',
    section: 'experience',
    text: '做完哪件事，你最有「值得」的感觉？',
    options: [
      { text: '解决了一个具体问题', dimension: 'build' },
      { text: '搞懂了一件复杂的事', dimension: 'analyze' },
      { text: '帮别人往前推了一步', dimension: 'people' },
      { text: '做出了一件属于自己的东西', dimension: 'express' },
    ],
  },
]

export const TOTAL_QUESTIONS = QUESTIONS.length

export function questionsOf(section: AssessmentType): Question[] {
  return QUESTIONS.filter((q) => q.section === section)
}

export function findQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id)
}
