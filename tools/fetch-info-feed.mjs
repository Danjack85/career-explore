/**
 * 信息雷达 feed 生成器。
 *
 * 从官方来源抓取「标题 / 链接 / 日期」——**只抓事实字段**。
 *
 * 为什么 impact（观点）和 action（行动点）不自动生成：
 *   那两项是判断，不是事实。机器生成的「意味着什么」就是编造结论，
 *   违反 docs/PRD.md 的「事实 / 观点 / 猜测分开」和「不伪造行业数据」。
 *   所以 feed 里它们留空，由用户在 App 里自己写（见 src/api/infoNotes.ts）。
 *
 * 用法：
 *   node tools/fetch-info-feed.mjs            # 抓取并写入 src/mock/infoFeed.generated.json
 *   node tools/fetch-info-feed.mjs --dry-run  # 只打印，不写文件
 *
 * 说明：
 *   - 只请求列表页，不抓正文（正文提取脆弱，且标题已足够说明「发生了什么」）。
 *   - 低频、少量请求，带 User-Agent 标识，不并发轰炸。
 *   - 站点改版会导致解析失败，脚本会明确报错而不是产出空 feed 覆盖好数据。
 */

import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = resolve(ROOT, 'src/mock/infoFeed.generated.json')
const DRY_RUN = process.argv.includes('--dry-run')

/** 来源清单。新增来源时：确认站点无 JS 反爬（人社部/工信部/人民网有，抓不到） */
const SOURCES = [
  {
    name: '国家统计局',
    level: '官方数据',
    listUrl: 'https://www.stats.gov.cn/sj/zxfb/',
    section: '最新发布',
  },
  {
    name: '国家统计局',
    level: '官方数据',
    listUrl: 'https://www.stats.gov.cn/sj/sjjd/',
    section: '数据解读',
  },
  {
    // 对「大学生 / 应届生」受众，这是最相关的一条线
    name: '教育部',
    level: '官方数据',
    listUrl: 'http://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/',
    section: '工作动态',
  },
  {
    name: '教育部',
    level: '官方数据',
    listUrl: 'http://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1778/',
    section: '政策文件',
  },
  {
    name: '国家发展改革委',
    level: '官方数据',
    listUrl: 'https://www.ndrc.gov.cn/xwdt/xwfb/',
    section: '新闻发布会',
  },
]

/**
 * 已尝试但抓不到的来源，留档避免下次重复踩坑：
 *   人社部     —— 返回 JS 反爬脚本（响应仅 986 字节）
 *   工信部     —— 首页几乎无可解析条目
 *   人民网     —— HTTP 403
 *   中国新闻网 —— HTTP 403（财经频道同样被拦）
 * 深度媒体这一档因此仍缺位，需要人工录入，见 docs/INFO_FEED.md。
 */

/**
 * 关键词 → 标签。同时用作相关性过滤：
 * 一条也不匹配的条目不进 feed（雷达只放与「找方向」相关的信息）。
 *
 * 从宽到窄排列：命中越靠前的规则，说明这条信息越贴近用户的实际处境。
 */
const KEYWORD_TAGS = [
  // 与「大学生 / 应届生」处境直接相关，优先级最高
  [/毕业生|应届|高校学生/, '毕业生'],
  // 注意排除「就业部」这类机构名，否则外交会见也会被打上「就业」
  [/就业(?!部)|招聘|用工|岗位|失业|求职|实习/, '就业'],
  [/职业|技能|培训|人才|资格/, '职业发展'],
  // 这里刻意不写宽泛的「教育」二字：教育部站点几乎所有标题都含「教育」，
  // 会把「青少年宪法法治教育座谈会」这类与找方向无关的条目全捞进来。
  // 只保留指向高等教育 / 就业培养的具体词。
  [/高等教育|职业教育|大学|高校|本科|学位|招生|专业设置|专业目录|学科|人才培养|教育改革/, '教育'],

  // 行业与经济结构
  [/工资|收入|薪酬|人均可支配/, '收入'],
  [/价格|CPI|PPI|通胀/, '价格'],
  [/工业|制造|产能|规上/, '制造业'],
  [/服务业|消费|零售|社会消费品/, '服务业'],
  [/固定资产|基建|投资/, '投资'],
  [/房地产|商品房|房价|地产/, '房地产'],
  [/高技术|新兴|数字经济|新动能|人工智能|新能源|芯片|集成电路|未来产业/, '新技术'],
  [/民营|中小企业|营商环境/, '企业'],
  [/能源|电力|煤炭|石油/, '能源'],

  // 政策类兜底
  [/政策|意见|通知|规划|条例|办法|纲要/, '政策'],
]

/**
 * 礼仪 / 外事类条目的噪声过滤。
 *
 * 这类标题（会见、贺信、致辞）几乎没有可行动的信息，对「找方向」没有帮助。
 * 不加这道过滤，它们会被关键词表捞进来 —— 实测「周海兵副主任会见芬兰经济事务与
 * 就业部长」就因为机构名里的「就业」二字被误标成就业类信息。
 */
const NOISE_PATTERN = /会见|致贺|贺信|贺电|祝贺|慰问|致辞|题词|贺辞|运动会|亚运会|奥运会|锦标赛|联赛|世界杯/

/**
 * 列表页常出现被截断的标题（以 ... 结尾）。这类条目的完整版通常也在列表里，
 * 如果不去掉，去重时会和完整版共存，雷达上会出现两条看着一样的条目。
 */
function isTruncated(title) {
  return /(\.\.\.|…)\s*$/.test(title)
}

/** 正文可能的日期写法都试一遍 */
function findDate(text) {
  const m =
    /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/.exec(text) ?? /(\d{4})\.(\d{1,2})\.(\d{1,2})/.exec(text)
  if (!m) return null
  const [, y, mo, d] = m
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function decodeBody(buf, contentType) {
  const head = new TextDecoder('latin1').decode(buf.slice(0, 2000))
  const charset = (
    /charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    /charset=([\w-]+)/i.exec(contentType ?? '')?.[1] ??
    'utf-8'
  ).toLowerCase()
  const normalized = charset === 'gb2312' || charset === 'gbk' ? 'gbk' : charset
  try {
    return new TextDecoder(normalized).decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

/** 稳定 id：同一篇文章在多次生成之间保持不变，用户的批注才不会丢 */
function stableId(url) {
  return 'info-' + createHash('sha1').update(url).digest('hex').slice(0, 12)
}

function extractFrom(html, baseUrl) {
  const found = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const title = m[2]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (title.length < 8 || title.length > 90) continue
    if (!/[\u4e00-\u9fa5]/.test(title)) continue
    if (isTruncated(title)) continue
    if (NOISE_PATTERN.test(title)) continue
    // 导航类文字不要
    if (/^(首页|上一页|下一页|更多|返回|网站地图|联系我们|关于我们)/.test(title)) continue

    const tail = html.slice(m.index, m.index + 600)
    const date = findDate(tail)
    const href = m[1].startsWith('http') ? m[1] : new URL(m[1], baseUrl).href

    found.push({ title, href, date })
  }
  return found
}

function tagsOf(title) {
  const hits = []
  for (const [re, tag] of KEYWORD_TAGS) {
    if (re.test(title) && !hits.includes(tag)) hits.push(tag)
  }
  return hits
}

async function fetchList(source) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 20000)
  try {
    const res = await fetch(source.listUrl, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        // HTTP 头只能是 latin1，不能出现中文，否则 fetch 直接抛错
        'User-Agent': 'career-explore-feed/0.1 (career exploration app; info radar)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = decodeBody(new Uint8Array(await res.arrayBuffer()), res.headers.get('content-type'))
    return extractFrom(html, source.listUrl)
  } finally {
    clearTimeout(timer)
  }
}

const collected = []
const errors = []

for (const source of SOURCES) {
  try {
    const raw = await fetchList(source)
    let kept = 0
    for (const item of raw) {
      const tags = tagsOf(item.title)
      if (tags.length === 0) continue // 与「找方向」无关，不进雷达
      collected.push({
        url: item.href,
        title: item.title,
        published_at: item.date,
        source_name: source.name,
        source_level: source.level,
        tags: [
          ...new Set([...tags, source.section]),
        ],
      })
      kept++
    }
    console.log(`  ${source.name}·${source.section}  解析 ${raw.length} 条 → 相关 ${kept} 条`)
    if (raw.length === 0) {
      errors.push(`${source.name}·${source.section} 解析到 0 条，站点结构可能已变`)
    }
  } catch (e) {
    errors.push(`${source.name}·${source.section} 抓取失败: ${String(e.message ?? e).slice(0, 80)}`)
  }
}

if (collected.length === 0) {
  console.error('\n没有抓到任何条目，未写入文件（避免用空 feed 覆盖已有数据）。')
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}

// 去重：先按 URL 精确去重，再按标题前 24 字去重
// （同一篇文章在列表页常有多个链接，个别链接的文字略有差异）
const seenUrl = new Set()
const byKey = new Map()
for (const item of collected) {
  if (seenUrl.has(item.url)) continue
  seenUrl.add(item.url)

  const key = item.title.replace(/[.．…\s]/g, '').slice(0, 24)
  const prev = byKey.get(key)
  // 冲突时保留标题更完整的那个
  if (!prev || item.title.length > prev.title.length) byKey.set(key, item)
}

/**
 * 每来源配额。
 *
 * 不加配额的话，纯按日期排序会让「发稿多、更新勤」的来源（如统计局一次发十几条）
 * 挤掉其他来源，雷达退化成单一来源的列表 —— 而来源多样性本身就是可信度的一部分
 * （docs/SCHEMA.md 把来源分六档，就是要求多档并存）。
 *
 * 做法是**先按来源各取最新的 N 条，再合并排序**。
 * 反过来先全局排序再限流是错的：较老的来源会被整段饿死，一条都进不来。
 */
const PER_SOURCE_CAP = 3

const bySource = new Map()
for (const item of byKey.values()) {
  // 按**来源**而非列表页分组：同一个部委开了两个栏目，也不该因此拿到双倍配额。
  const key = item.source_name
  const list = bySource.get(key)
  if (list) list.push(item)
  else bySource.set(key, [item])
}

const picked = []
for (const list of bySource.values()) {
  list.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  picked.push(...list.slice(0, PER_SOURCE_CAP))
}

// 合并后再按日期倒序，让最新的排前面
picked.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))

const items = picked
  .slice(0, 15)
  .map((item) => ({
    id: stableId(item.url),
    title: item.title,
    source_name: item.source_name,
    source_level: item.source_level,
    url: item.url,
    published_at: item.published_at ?? '待核实',
    // 以下三项留空，理由见文件头注释
    summary: '',
    impact: '',
    action: '',
    tags: item.tags,
    created_at: new Date().toISOString(),
  }))

const feed = {
  version: 1,
  generated_at: new Date().toISOString(),
  generator: 'tools/fetch-info-feed.mjs',
  note:
    '自动抓取自官方来源，只含标题 / 链接 / 日期等事实字段。' +
    'summary / impact / action 留空 —— 「意味着什么」和「该做什么」是判断，不由脚本生成。',
  sources: SOURCES.map((s) => ({ name: s.name, level: s.level, list_url: s.listUrl })),
  items,
}

console.log(`\n共 ${items.length} 条：`)
for (const it of items) console.log(`  [${it.published_at}] ${it.title.slice(0, 44)}  ${it.tags.join('/')}`)
if (errors.length) {
  console.log('\n警告：')
  for (const e of errors) console.log('  ' + e)
}

if (DRY_RUN) {
  console.log('\n--dry-run，未写入文件。')
} else {
  writeFileSync(OUT_FILE, JSON.stringify(feed, null, 2) + '\n', 'utf8')
  console.log(`\n已写入 ${OUT_FILE}`)
}
