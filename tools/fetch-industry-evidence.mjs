/**
 * 行业卡片证据生成器。
 *
 * 为什么需要：
 *   行业卡片里的「阶段 / 风险」是**编辑判断**，不是数据。PRD 要求
 *   「每个行业结论有来源和日期」——判断必须能挂到可核验的事实上。
 *   这个脚本从官方来源提取**真实统计数字**作为证据。
 *
 * 三条硬规矩：
 *   1. 只取官方原文**原句**，不改写、不推论。
 *   2. 取该页的**主指标**（按正文出现顺序），不挑对自己有利的数字。
 *   3. **指标与行业必须直接对应**。用宽口径数字（如「第三产业投资」）去撑
 *      具体行业（如「企业服务 SaaS」）属于隐含的过度关联，等同于编造，不做。
 *
 * 因此本脚本会为**全部**行业给出状态，而不是只给能挂上的那几个：
 *   stat   —— 有直接对应的官方统计，附原句
 *   policy —— 有官方政策文件（非统计数字，标注清楚）
 *   none   —— 官方统计未单列该口径，界面显示「来源待人工补充」，不编
 *
 * 用法：
 *   node tools/fetch-industry-evidence.mjs
 *   node tools/fetch-industry-evidence.mjs --dry-run
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = resolve(ROOT, 'src/mock/industryEvidence.generated.json')
const DRY_RUN = process.argv.includes('--dry-run')

/** 用于定位文章的列表页 */
const LIST_URLS = [
  'https://www.stats.gov.cn/sj/zxfb/',
  'https://www.stats.gov.cn/sj/sjjd/',
  'http://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1778/',
]

/**
 * 行业清单。每个行业都必须在表里 —— 挂不上也要显式写 `none` 和原因，
 * 让「哪些行业没有官方口径」成为一条明确信息，而不是一片沉默。
 *
 * `indicator` 只在该行业有直接对应统计时给出。
 */
const INDUSTRIES = [
  {
    industry: 'real-estate',
    industryName: '房地产',
    article: /全国房地产市场基本情况/,
    indicators: [/房屋新开工面积.*(下降|增长)/, /房地产开发投资.*(下降|增长)/, /房屋新开工面积|房地产开发投资/],
    note: '开发投资与新开工面积是房地产景气的先行指标',
  },
  {
    industry: 'new-energy',
    industryName: '新能源',
    article: /能源生产情况/,
    // 按优先级取指标：先用「风电/太阳能 +增速」这种直接给数字的句子；
    // 取不到再退回「风电/太阳能」泛提。
    // 刻意不用「发电量」总量：总量受火电拖累（8月同比 -0.8%），
    // 拿它撑「成长」判断会自相矛盾。
    indicators: [/(风电|太阳能发电)(增长|下降)/, /风电|太阳能发电/],
    note: '风电与太阳能发电量是新能源装机和消纳的直接指标',
  },
  {
    industry: 'local-life',
    industryName: '本地生活',
    article: /社会消费品零售总额/,
    // 餐饮收入比社零总额更贴近「到店消费」，是本地生活的直接口径
    indicators: [/餐饮收入.*(增长|下降)/, /餐饮收入/],
    note: '餐饮收入是到店消费的直接口径',
  },
  {
    industry: 'online-education',
    industryName: '在线教育',
    article: /教育发展.十五五.规划/,
    note: '政策文件（非统计数字），用于说明监管与发展的框架',
    policy: true,
  },
  // ---- 以下行业官方统计未单列该口径，显式标注，不用宽口径数字硬凑 ----
  {
    industry: 'ai-application',
    industryName: '人工智能应用',
    none: '官方统计未单列「人工智能应用」口径；相关数据分散在高技术产业投资等宽口径中，无法直接对应',
  },
  {
    industry: 'cross-border-ecommerce',
    industryName: '跨境电商',
    none: '海关总署有进出口数据，但未细分到跨境电商口径；本脚本未接入海关来源',
  },
  {
    industry: 'enterprise-saas',
    industryName: '企业服务SaaS',
    none: '官方统计未单列 SaaS 口径；用「第三产业投资」这类宽口径硬套属于过度关联，不做',
  },
  {
    industry: 'semiconductor',
    industryName: '半导体',
    none: '统计局分行业增加值未单列半导体；集成电路产量在「主要工业产品产量」中，本脚本未接入',
  },
  {
    industry: 'traditional-media',
    industryName: '传统媒体',
    none: '官方统计未单列传统媒体口径',
  },
  {
    industry: 'gaming',
    industryName: '游戏',
    none: '官方统计未单列游戏口径；版号与收入数据在主管部门与行业报告中，本脚本未接入',
  },
]

function decode(buf, ct) {
  const head = new TextDecoder('latin1').decode(buf.slice(0, 2000))
  const cs = (
    /charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    /charset=([\w-]+)/i.exec(ct ?? '')?.[1] ??
    'utf-8'
  ).toLowerCase()
  const n = cs === 'gb2312' || cs === 'gbk' ? 'gbk' : cs
  try {
    return new TextDecoder(n).decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

async function get(url) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 20000)
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'career-explore-feed/0.1 (career exploration app)' },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const html = decode(new Uint8Array(await r.arrayBuffer()), r.headers.get('content-type'))
    return { html }
  } finally {
    clearTimeout(t)
  }
}

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
}

/**
 * 取发布日期。优先 `<meta name="PubDate">`（权威），
 * 退回 URL 里的 `t20260915_`，最后才在正文里找。
 */
function findDate(html, url) {
  const meta = /<meta[^>]*name=["']PubDate["'][^>]*content=["']([^"']+)["']/i.exec(html)
  if (meta) {
    const m = /(20\d{2})[/-](\d{1,2})[/-](\d{1,2})/.exec(meta[1])
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
  }
  const fromUrl = /t(20\d{2})(\d{2})(\d{2})_/.exec(url)
  if (fromUrl) return `${fromUrl[1]}-${fromUrl[2]}-${fromUrl[3]}`
  const body = /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(toText(html).slice(0, 4000))
  if (body) return `${body[1]}-${String(body[2]).padStart(2, '0')}-${String(body[3]).padStart(2, '0')}`
  return null
}

/** 按正文出现顺序取主指标句，最多 2 条。indicators 按优先级依次尝试。 */
function extractStats(text, indicators) {
  const sentences = text
    .split(/[。；]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.length < 120)

  for (const indicator of indicators) {
    const hits = []
    const seen = new Set()
    for (const s of sentences) {
      if (!indicator.test(s)) continue
      if (!/\d/.test(s)) continue
      if (/搜索|首页|机构|新闻|时政要闻|统计新闻|数据 公开|服务 互动|知识 专题/.test(s)) continue
      const clean = s.replace(/\s+/g, '')
      // 官方页正文常用重复段落做排版，同一句会出现多次
      if (seen.has(clean)) continue
      seen.add(clean)
      hits.push(clean)
      if (hits.length >= 2) break
    }
    if (hits.length > 0) return hits
  }
  return []
}

// ---- 建立「文章标题 → url」索引 ----
const listIndex = []
const listProblems = []
for (const listUrl of LIST_URLS) {
  try {
    const { html } = await get(listUrl)
    const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m
    while ((m = re.exec(html))) {
      const title = m[2].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      if (title.length < 8 || title.length > 90) continue
      if (!/[\u4e00-\u9fa5]/.test(title)) continue
      listIndex.push({
        title,
        url: m[1].startsWith('http') ? m[1] : new URL(m[1], listUrl).href,
      })
    }
  } catch (e) {
    listProblems.push(`${listUrl} 抓取失败: ${String(e.message ?? e).slice(0, 50)}`)
  }
}

// ---- 逐行业取证据 ----
const evidence = []
const problems = []

for (const def of INDUSTRIES) {
  if (def.none) {
    evidence.push({
      industry: def.industry,
      industry_name: def.industryName,
      status: 'none',
      reason: def.none,
    })
    console.log(`— ${def.industryName.padEnd(12)} 无官方对口统计（显式标注）`)
    continue
  }

  const hit = listIndex
    .slice()
    .reverse()
    .find((it) => def.article.test(it.title))

  if (!hit) {
    problems.push(`${def.industryName}：列表里没找到匹配文章 ${def.article}`)
    evidence.push({
      industry: def.industry,
      industry_name: def.industryName,
      status: 'none',
      reason: '列表页里未找到对应文章，抓取可能已失效',
    })
    continue
  }

  try {
    const { html } = await get(hit.url)
    const date = findDate(html, hit.url)
    const text = toText(html)

    if (def.policy) {
      evidence.push({
        industry: def.industry,
        industry_name: def.industryName,
        status: 'policy',
        name: '教育部',
        level: '官方数据',
        url: hit.url,
        article_title: hit.title,
        date: date ?? '待核实',
        quote: null,
        note: def.note,
        fetched_at: new Date().toISOString(),
      })
      console.log(`◆ ${def.industryName.padEnd(12)} ${date ?? '日期未取到'}  [政策文件] ${hit.title.slice(0, 34)}`)
      continue
    }

    const stats = extractStats(text, def.indicators)
    if (stats.length === 0) {
      problems.push(`${def.industryName}：正文里没提取到主指标句`)
      evidence.push({
        industry: def.industry,
        industry_name: def.industryName,
        status: 'none',
        reason: '正文未提取到主指标句，抓取可能已失效',
      })
      continue
    }

    evidence.push({
      industry: def.industry,
      industry_name: def.industryName,
      status: 'stat',
      name: '国家统计局',
      level: '官方数据',
      url: hit.url,
      article_title: hit.title,
      date: date ?? '待核实',
      quote: stats[0],
      extra_quote: stats[1] ?? null,
      note: def.note,
      fetched_at: new Date().toISOString(),
    })
    console.log(`✓ ${def.industryName.padEnd(12)} ${date ?? '日期未取到'}  ${stats[0].slice(0, 50)}`)
  } catch (e) {
    problems.push(`${def.industryName}：正文抓取失败 ${String(e.message ?? e).slice(0, 50)}`)
    evidence.push({
      industry: def.industry,
      industry_name: def.industryName,
      status: 'none',
      reason: '正文抓取失败，请重新运行脚本',
    })
  }
}

const byStatus = evidence.reduce((m, e) => {
  m[e.status] = (m[e.status] ?? 0) + 1
  return m
}, {})

const payload = {
  version: 1,
  generated_at: new Date().toISOString(),
  generator: 'tools/fetch-industry-evidence.mjs',
  note:
    'quote 是官方原文原句，未改写，用于支撑卡片判断；它支撑判断但不等于判断本身。' +
    'status=none 的行业是官方统计未覆盖该口径，界面显示「来源待人工补充」，不编造。',
  counts: byStatus,
  evidence,
}

console.log(`\n统计口径 ${byStatus.stat ?? 0} 个 · 政策文件 ${byStatus.policy ?? 0} 个 · 无官方口径 ${byStatus.none ?? 0} 个`)
if (listProblems.length) {
  console.log('\n列表页问题：')
  for (const p of listProblems) console.log('  · ' + p)
}
if (problems.length) {
  console.log('\n需注意：')
  for (const p of problems) console.log('  · ' + p)
}

if (DRY_RUN) {
  console.log('\n--dry-run，未写入文件。')
} else {
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`\n已写入 ${OUT_FILE}`)
}
