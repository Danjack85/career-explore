# SCHEMA — 数据结构

本文件是数据结构的**唯一权威**。任何结构变更先改这里，再改代码。

## 总览

| 表 | 用途 | 归属 |
| --- | --- | --- |
| `profiles` | 用户档案 | 用户 |
| `industry_cards` | 行业卡片（行业地图数据源） | 公共 |
| `assessments` | 测评记录 | 用户 |
| `info_items` | 信息雷达条目 | 公共 |
| `plans` | 计划（五层拆解） | 用户 |
| `experiments` | 实验主表 | 用户 |
| `experiment_logs` | 实验每日记录 | 用户 |

约定：

- 主键统一 `id`（uuid）。
- 时间统一 ISO 8601 字符串，前端存 `localStorage` 时同样用 ISO 字符串。
- 用户私有数据额外带 `user_id`；本地 mock 阶段 `user_id` 固定为 `local-user`。
- 枚举值用字符串字面量联合类型约束，不用数字码。

---

## profiles

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 主键，等于登录用户 id |
| nickname | string | 昵称 |
| created_at | string | 创建时间 |

## industry_cards

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 主键 |
| name | string | 行业名 |
| stage | string | 阶段，见枚举 |
| summary | string | 一句话说明这个行业在干什么 |
| jobs | string[] | 典型岗位 |
| skills | string[] | 需要的技能 |
| salary_range | string | 薪资区间（写口径与年份，无法确认写「待核实」） |
| cities | string[] | 主要城市 |
| risks | string[] | 风险点 |
| sources | IndustrySource[] | 真实来源（结构化，见下）。**空数组**表示官方统计未覆盖该口径 |
| source_note | string | 无来源时说明原因；有来源时为空串 |
| source_date | string | 最新来源日期，无法确认写「待核实」 |
| updated_at | string | 编辑内容的更新时间 |

`stage` 枚举：`萌发` / `成长` / `成熟` / `衰退` / `低谷观察`

> `低谷观察`：处于低谷但存在结构性变化值得持续观察，不等同于「不要进」。

### IndustrySource（行业来源）

`source_date` 字段保留，但 `sources` 由 `string[]` 改为**结构化**，原因是：
卡片上的「阶段 / 风险」是编辑判断，只存一个字符串没法让用户点开原文核验，
也无法区分「统计数字」与「政策文件」——两者的可信含义不同。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 来源机构，如「国家统计局」 |
| level | string | 来源等级，取值同 `info_items.source_level` |
| url | string | 原文链接 |
| date | string | 发布或数据日期，取不到写「待核实」 |
| quote | string \| null | **官方原文原句，未改写**；政策文件类为 null |
| extra_quote | string \| null | 第二条原句，可空 |
| note | string | 该指标与这个行业的关系说明 |
| kind | string | `stat`（统计数据）/ `policy`（政策文件） |

**编辑内容与来源分开存放**（这是刻意的，不要合并回一个文件）：

| 文件 | 内容 |
| --- | --- |
| `src/mock/industries.ts` | 编辑判断：阶段 / 岗位 / 技能 / 风险 / 城市 |
| `src/mock/industryEvidence.generated.json` | 由 `tools/fetch-industry-evidence.mjs` 抓取的官方证据 |
| `src/api/industry.ts` | 合并两者，产出 `IndustryCard` |

理由：事实每月更新，判断改得没那么勤；混在一个文件里会看着像一回事。

**薪资**：`salary_range` 一律「待核实」。没有可引用的薪资来源就不写数字 ——
招聘平台报告多为 PDF 或需授权，自动抓不到；人工核实前保持空缺。

## assessments

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 主键 |
| user_id | string | 归属用户 |
| type | string | `interest` / `values` / `experience` |
| answers | object | 原始作答 |
| result_keywords | string[] | 结果关键词 |
| result_summary | string | 结果说明（只提示，不断言） |
| created_at | string | 创建时间 |

## info_items

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 主键 |
| title | string | 标题 |
| source_name | string | 来源名称 |
| source_level | string | 来源等级，见枚举 |
| url | string | 原文链接 |
| published_at | string | 发布时间 |
| summary | string | 发生了什么（事实） |
| impact | string | 对找方向的人意味着什么（**判断**，允许为空） |
| action | string | 可以做什么（行动点，**判断**，允许为空） |
| tags | string[] | 标签 |
| created_at | string | 创建时间 |

> **`impact` / `action` 允许为空**：这两项是判断，不是事实。自动抓取只产出
> `title` / `url` / `published_at` 等事实字段，判断留给用户自己写
> （实现见 `src/api/infoNotes.ts`，存本地、按条目 id 关联）。
> 界面在为空时显示「待你判断」，不得用机器生成的话术填充。
> 详见 `docs/INFO_FEED.md`。

`source_level` 枚举（按可信度从高到低）：

1. `官方数据` — 统计局、部委、行业协会年报
2. `招聘平台报告` — 平台年度 / 季度人才报告
3. `券商研报` — 有署名分析师的行业研究
4. `深度媒体` — 有事实核查流程的报道
5. `从业者访谈` — 一手访谈，样本有限但真实
6. `自媒体` — 仅作线索

> 前 4 级可作结论依据；第 5 级需至少 2 个独立来源交叉；第 6 级只能用于发现线索，不能单独支撑行业结论。

## plans

一个用户一份有效计划。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 主键 |
| user_id | string | 归属用户 |
| five_year_hypothesis | string | 五年方向假设（允许是猜的） |
| one_year_theme | string | 一年主题 |
| quarter_project | string | 本季度项目 |
| month_experiment | string | 本月实验 |
| week_action | string | 本周动作 |
| updated_at | string | 更新时间 |

## experiments

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 主键 |
| user_id | string | 归属用户 |
| title | string | 实验标题 |
| direction | string | 探索方向 |
| hypothesis | string | 假设，必须可证伪 |
| start_date | string | 开始日期 |
| end_date | string | 结束日期（通常 start + 6 天） |
| status | string | `planned` / `running` / `done` / `dropped` |
| conclusion | string \| null | 复盘结论：`继续` / `排除` / `换方式`；未复盘为 `null` |
| template_id | string \| null | 创建时用的模板 id（`src/api/experimentTemplates.ts`）；手动创建为 `null` |
| created_at | string | 创建时间 |

> **`conclusion` 与 `status` 的分工**：`status` 描述实验进程（还没开始 / 进行中 / 已结束 / 已放弃），
> `conclusion` 记录第 7 天复盘时用户做出的判断。两者不能互相替代 —— 「继续」和「换方式」都会结束
> 本次实验（`status = done`），但后续动作完全不同，必须分开存。
>
> 该字段是实现 `docs/FLOW.md` 与 T07 复盘要求所必需的，属于对最初字段清单的补充。

## experiment_logs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 主键 |
| experiment_id | string | 外键 → experiments.id |
| day | number | 第几天，1-7 |
| did | string | 今天做了什么 |
| energy | number | 能量 1-5 |
| like | string | 今天喜欢的 |
| dislike | string | 今天讨厌的 |
| next | string | 明天要做的 |
| created_at | string | 创建时间 |

同一实验每天最多一条记录。

> **`template_id` 的用途**：实验模板库（`/templates`）是 App 自己的方法内容，
> 解决「迷茫的学生写不出可证伪假设、设计不出 7 天任务」的冷启动问题。
> 有值时详情页显示模板的「今日建议任务」；模板内容更新或下线时详情页降级提示，
> 不影响已有记录。与 `conclusion` 一样属于对最初字段清单的补充。
