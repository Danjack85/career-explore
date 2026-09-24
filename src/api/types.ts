// 全项目共享的数据类型。字段与 docs/SCHEMA.md 一一对应，改这里必须同步改文档。

/** 行业阶段，取值见 docs/SCHEMA.md */
export type IndustryStage = '萌发' | '成长' | '成熟' | '衰退' | '低谷观察'

export const INDUSTRY_STAGES: readonly IndustryStage[] = [
  '萌发',
  '成长',
  '成熟',
  '衰退',
  '低谷观察',
]

/**
 * 行业卡片的来源。
 *
 * 结构化的原因：卡片上的「阶段 / 风险」是编辑判断，必须能挂到可核验的事实上。
 * 只存一个字符串没法让用户点开原文核验，所以保留 机构 / 链接 / 日期 / 原句。
 */
export interface IndustrySource {
  /** 来源机构，如「国家统计局」 */
  name: string
  /** 来源等级，见 SourceLevel */
  level: SourceLevel
  url: string
  /** 发布或数据日期（YYYY-MM-DD）；取不到时写「待核实」 */
  date: string
  /** 官方原文原句，未改写。政策文件类来源为 null */
  quote: string | null
  /** 第二条原句，可为 null */
  extra_quote: string | null
  /** 该指标与这个行业的关系说明 */
  note: string
  /** 证据类型：统计数据 / 政策文件。两者的可信含义不同，界面要分开标 */
  kind: 'stat' | 'policy'
}

export interface IndustryCard {
  id: string
  name: string
  stage: IndustryStage
  summary: string
  jobs: string[]
  skills: string[]
  /** 薪资区间。无法确认时写「待核实」，不编造数字 */
  salary_range: string
  cities: string[]
  risks: string[]
  /** 真实来源。空数组表示官方统计未覆盖该口径，界面须显式标注 */
  sources: IndustrySource[]
  /** 没有来源时说明原因，不编造 */
  source_note: string
  /** 最新来源日期；无来源时「待核实」 */
  source_date: string
  updated_at: string
}

/** 信息来源等级，按可信度从高到低，取值见 docs/SCHEMA.md */
export type SourceLevel =
  | '官方数据'
  | '招聘平台报告'
  | '券商研报'
  | '深度媒体'
  | '从业者访谈'
  | '自媒体'

/** 可单独支撑结论的来源等级（前 4 级） */
export const TRUSTED_SOURCE_LEVELS: readonly SourceLevel[] = [
  '官方数据',
  '招聘平台报告',
  '券商研报',
  '深度媒体',
]

/** 仅可作为线索、不能单独支撑结论的来源等级 */
export const LEAD_ONLY_SOURCE_LEVELS: readonly SourceLevel[] = ['从业者访谈', '自媒体']

export interface InfoItem {
  id: string
  title: string
  source_name: string
  source_level: SourceLevel
  url: string
  published_at: string
  /** 发生了什么（事实） */
  summary: string
  /** 对找方向的人意味着什么（观点） */
  impact: string
  /** 可以做什么（行动点） */
  action: string
  tags: string[]
  created_at: string
}

export type AssessmentType = 'interest' | 'values' | 'experience'

/** 作答：题目 id → 选项下标 */
export type AssessmentAnswers = Record<string, number>

export interface Assessment {
  id: string
  user_id: string
  type: AssessmentType
  answers: AssessmentAnswers
  result_keywords: string[]
  result_summary: string
  created_at: string
}

export interface Plan {
  id: string
  user_id: string
  /** 五年方向假设，允许是猜的 */
  five_year_hypothesis: string
  one_year_theme: string
  quarter_project: string
  month_experiment: string
  week_action: string
  updated_at: string
}

export type ExperimentStatus = 'planned' | 'running' | 'done' | 'dropped'

/** 第 7 天复盘结论 */
export type ExperimentConclusion = '继续' | '排除' | '换方式'

export interface Experiment {
  id: string
  user_id: string
  title: string
  direction: string
  /** 假设，必须可证伪 */
  hypothesis: string
  start_date: string
  end_date: string
  status: ExperimentStatus
  /** 复盘结论；未复盘时为 null */
  conclusion: ExperimentConclusion | null
  /**
   * 创建时用的模板 id（src/api/experimentTemplates.ts）。
   * 有值时详情页可显示模板的「今日建议任务」。手动创建的实验为 null。
   */
  template_id: string | null
  created_at: string
}

export interface ExperimentLog {
  id: string
  experiment_id: string
  /** 第几天，1-7 */
  day: number
  did: string
  /** 能量 1-5 */
  energy: number
  like: string
  dislike: string
  next: string
  created_at: string
}

/** 本地阶段固定使用的用户 id，接 Supabase 后替换为真实 auth uid */
export const LOCAL_USER_ID = 'local-user'

/** 实验天数固定 7 天 */
export const EXPERIMENT_DAYS = 7
