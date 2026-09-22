/**
 * 行业卡片 —— **编辑内容**。
 *
 * 这个文件只放编辑判断（阶段 / 说明 / 岗位 / 技能 / 风险 / 城市）。
 * **真实来源不在这里**，由 `tools/fetch-industry-evidence.mjs` 抓取后生成到
 * `src/mock/industryEvidence.generated.json`，在 `src/api/industry.ts` 合并进来。
 *
 * 分开的原因：
 *   - 编辑内容和抓取事实的生命周期不同：事实每月更新，判断改得没那么勤。
 *   - 避免把「我写的判断」和「官方数字」混在同一个文件里，看着像一回事。
 *
 * 三条不能破的规矩（见 docs/PRD.md 与 AGENTS.md）：
 *   1. `salary_range` 一律「待核实」—— 没有可引用的薪资来源，就不写数字。
 *   2. 定性描述（summary / jobs / skills / risks）不含统计数字，避免看起来像有据可查。
 *   3. 官方统计未覆盖的行业，界面显式标注「来源待人工补充」，不编。
 */

import type { IndustryCard, IndustryStage } from '@/api/types'

const PLACEHOLDER_SALARY = '待核实'
const UPDATED_AT = '2026-09-22'

/**
 * 基础数据。`sources` / `source_note` / `source_date` 三个字段留空，
 * 由 src/api/industry.ts 从证据文件填充。
 */
type IndustrySeed = Omit<IndustryCard, 'sources' | 'source_note' | 'source_date'>

interface Seed extends IndustrySeed {
  stage: IndustryStage
}

export const INDUSTRY_SEEDS: Seed[] = [
  {
    id: 'ai-application',
    name: '人工智能应用',
    stage: '成长',
    summary:
      '把模型能力包装成具体场景里的产品与工具，例如客服、写作、编码、设计辅助。岗位需求集中在少数头部团队，多数从业者做的是场景落地而不是训练模型。',
    jobs: ['AI 产品经理', '应用算法工程师', '评测工程师', 'AI 解决方案工程师', '数据标注与质检'],
    skills: ['Python', '调用模型 API', '数据处理', '场景理解', '评测与效果设计'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['北京', '上海', '深圳', '杭州', '广州'],
    risks: [
      '技术迭代快，今天熟练的工具半年后可能被替代',
      '大量岗位本质是「调用 API + 调参」，个人壁垒不高',
      '数据合规与内容安全要求趋严，部分场景受政策影响',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'new-energy',
    name: '新能源',
    stage: '成长',
    summary:
      '围绕发电、储能、输配和用电设备展开的产业链，包含光伏、风电、储能与新能源汽车相关环节。制造端岗位多，研发端集中在头部企业。',
    jobs: ['电池研发工程师', '工艺工程师', '储能系统工程师', '电力电子工程师', '项目开发与商务'],
    skills: ['材料与电化学基础', '电气与控制', '实验与工艺调试', '项目推进'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['宁德', '深圳', '常州', '西安', '合肥'],
    risks: [
      '产能过剩与价格战明显，行业周期波动大',
      '制造端产线节奏快，部分岗位加班强度高',
      '补贴与政策变化直接影响需求，进而影响招聘',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'cross-border-ecommerce',
    name: '跨境电商',
    stage: '成长',
    summary:
      '把国内供应链的商品卖到海外市场，靠平台或独立站获客，工作内容包含选品、运营、投放、物流与合规。入行门槛低，但做法分化很大。',
    jobs: ['选品/品类运营', '独立站运营', '广告投放', '物流与供应链', '海外客服'],
    skills: ['数据分析', '平台规则理解', '外语读写', '投放与素材判断'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['深圳', '广州', '杭州', '义乌', '厦门'],
    risks: [
      '平台规则、关税与合规政策变动频繁，业务容易推倒重来',
      '汇率与物流成本波动直接吃掉利润',
      '入门岗位可替代性高，容易长期停留在纯执行层',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'local-life',
    name: '本地生活',
    stage: '成熟',
    summary:
      '餐饮、到店服务、即时零售等围绕「身边三公里」的生意，线上平台与线下门店深度结合。岗位以城市运营、商家拓展和门店经营为主。',
    jobs: ['城市/区域运营', '商家拓展（BD）', '门店店长', '履约与配送运营', '内容探店'],
    skills: ['沟通与谈判', '地推与陌拜', '数据看板解读', '门店经营常识'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['全国广泛分布，一线到三线城市均有需求'],
    risks: [
      '增长依赖平台补贴，商家利润薄，从业者收入波动大',
      '一线岗位体力与人情消耗大，隐性成本高',
      '行业整体进入存量竞争，增量岗位减少',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'enterprise-saas',
    name: '企业服务SaaS',
    stage: '成熟',
    summary:
      '给企业提供软件订阅服务，覆盖协同、人力、财务、客服、营销等模块。岗位分化明显：销售与客户成功占大头，产品与研发集中在少数公司。',
    jobs: ['SaaS 销售', '客户成功', '产品经理', '实施顾问', '后端/前端工程师'],
    skills: ['业务流程理解', 'SQL 与数据基础', '方案表达', '客户沟通'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['北京', '上海', '深圳', '杭州', '成都'],
    risks: [
      '国内企业付费意愿与续费率偏低，销售周期长',
      '岗位需求受经济周期影响明显，缩编常见',
      '通用工具类产品同质化严重，价格战激烈',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'semiconductor',
    name: '半导体',
    stage: '成长',
    summary:
      '从设计、制造到封装测试的芯片产业链，以及配套的设备与材料。设计与制造是两条差别很大的职业路径，对口的专业背景要求高。',
    jobs: [
      '数字/模拟 IC 设计',
      '版图设计',
      '工艺整合工程师',
      '设备与工艺工程师',
      '封装测试工程师',
    ],
    skills: ['微电子与器件物理', 'Verilog / 模拟电路', '失效分析', '良率与工艺数据分析'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['上海', '深圳', '无锡', '合肥', '西安'],
    risks: [
      '重资产、周期性强，景气度波动直接反映在招聘上',
      '制造端需要倒班、进洁净室，有身体成本',
      '国产替代节奏存在不确定性，部分环节扩产计划会调整',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'real-estate',
    name: '房地产',
    stage: '衰退',
    summary:
      '住宅与商业地产的开发、销售、运营及相关服务链条。岗位总量在持续收缩，存量业务（物业、资管）相对稳定。',
    jobs: ['投资测算', '开发报建', '工程管理', '销售与渠道', '物业与资产管理'],
    skills: ['财务测算', '政策与法规理解', '多方协调', '销售能力'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['一线与强二线城市的核心区域'],
    risks: [
      '行业处于长期下行通道，岗位总量收缩',
      '民营房企就业稳定性差，欠薪与裁员风险高',
      '既有经验的可迁移性需要重新评估，转行成本不低',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'online-education',
    name: '在线教育',
    stage: '低谷观察',
    summary:
      '学科培训收缩后，行业重心转向职业教育、成人学习、素质教育和教育硬件。仍在下行后的重组期，结构性变化值得持续观察，不等同于「不要进」。',
    jobs: ['教研', '课程产品', '直播运营', '学习规划顾问', '教育硬件产品'],
    skills: ['内容与教研能力', '用户增长', '转化与私域运营'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['北京', '上海', '杭州', '成都', '武汉'],
    risks: [
      '政策不确定性仍在，业务方向可能被动调整',
      '销售与转化导向岗位占比高，考核压力大',
      '部分细分赛道规模天花板低，晋升空间有限',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'traditional-media',
    name: '传统媒体',
    stage: '衰退',
    summary:
      '报纸、杂志、广播电视等传统内容生产与分发机构，普遍在向新媒体转型。编制收紧，岗位需求更多来自融媒体中心与工作室。',
    jobs: ['记者/编辑', '视频编导', '融媒体运营', '内容策划', '播音主持'],
    skills: ['采写与事实核查', '拍摄与剪辑', '选题判断', '多平台内容分发'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['北京', '上海', '广州', '长沙', '各级省市媒体所在地'],
    risks: [
      '广告收入长期下滑，编制与待遇收紧',
      '个人发展与个人品牌强绑定，机构加持减弱',
      '晋升通道变窄，中高层岗位流动性低',
    ],
    updated_at: UPDATED_AT,
  },
  {
    id: 'gaming',
    name: '游戏',
    stage: '成熟',
    summary:
      '游戏研发、发行与运营，含手游、端游、主机与出海业务。项目制成组，团队随项目聚散，岗位对作品集的依赖高于学历。',
    jobs: ['游戏策划（系统/数值/剧情）', '客户端与服务端开发', '美术（原画/3D/特效）', '发行与运营', 'QA'],
    skills: ['Unity / Unreal 等引擎', '编程或美术工具链', '玩家理解', '数据分析'],
    salary_range: PLACEHOLDER_SALARY,
    cities: ['深圳', '上海', '广州', '成都', '北京'],
    risks: [
      '项目制运作，版号与政策影响大，项目组解散常见',
      '加班强度在部分公司较普遍',
      '岗位高度依赖项目经验，入行与转岗都有门槛',
    ],
    updated_at: UPDATED_AT,
  },
]
