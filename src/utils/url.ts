/**
 * URL 安全校验 —— 共用工具。
 *
 * 用途：项目里凡是「可配置的出站地址」（Supabase 端点、信息雷达的远程 feed），
 * 在真正发出请求前都必须过这道关，避免把请求打到本机、内网或保留地址上。
 *
 * 为什么单独成文件：原先这个函数放在 src/utils/supabase.ts 里，只有 Supabase 用；
 * 现在信息雷达也要用，两处共用，所以抽出来。
 *
 * 判断依据是**解析后的 hostname**，不是原始字符串。
 * 这样能顺带挡掉 IPv4 的非常规写法 —— WHATWG URL 会把
 * `http://2130706433/`、`http://0x7f.0.0.1/`、`http://0177.0.0.1/`
 * 统统规范化成 `127.0.0.1`，所以只要检查规范化结果就够了。
 */

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/**
 * 把 IPv6 展开成 8 个 16 位分组。
 *
 * 为什么要展开而不是做字符串前缀匹配：
 * WHATWG URL 会把 `::ffff:192.168.1.1` 规范化成 `::ffff:c0a8:101`（十六进制形式），
 * 所以按点分四段去匹配映射地址会直接漏掉 —— 实测就是这么漏的。
 * 展开成数值后，所有写法都归一了。
 *
 * 返回 null 表示无法解析（调用方应视为不安全）。
 */
function expandIpv6(input: string): number[] | null {
  // 去掉 zone id，如 fe80::1%eth0
  const h = input.split('%')[0].toLowerCase()

  const halves = h.split('::')
  if (halves.length > 2) return null // `::` 最多出现一次

  const parse = (part: string): number[] | null => {
    if (part === '') return []
    const out: number[] = []
    for (const g of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null
      out.push(Number.parseInt(g, 16))
    }
    return out
  }

  let head: number[]
  let tail: number[]

  if (halves.length === 2) {
    const [a, b] = [parse(halves[0]), parse(halves[1])]
    if (a === null || b === null) return null
    head = a
    tail = b
    // 压缩形式必须留出至少一组的空间
    if (head.length + tail.length > 7) return null
  } else {
    const only = parse(h)
    if (only === null) return null
    if (only.length !== 8) return null
    head = only
    tail = []
  }

  const groups = [...head, ...Array(8 - head.length - tail.length).fill(0), ...tail]
  return groups.length === 8 ? groups : null
}

/** IPv4 私有 / 环回 / 链路本地 / 保留 / 组播 网段 */
function isBlockedIpv4(host: string): boolean {
  const m = host.match(IPV4_RE)
  if (!m) return false

  const octets = [m[1], m[2], m[3], m[4]].map(Number)
  if (octets.some((n) => n > 255)) return true // 非法写法，一律拒绝

  const [a, b, c] = octets
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10/8 私有
  if (a === 127) return true // 环回
  if (a === 169 && b === 254) return true // 链路本地
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12 私有
  if (a === 192 && b === 168) return true // 192.168/16 私有
  if (a === 192 && b === 0 && c === 0) return true // 192.0.0/24 保留
  if (a === 198 && (b === 18 || b === 19)) return true // 基准测试网段
  if (a >= 224) return true // 组播 + 保留
  return false
}

/** 由 8 个分组拼出点分四段，用于检查内嵌的 IPv4 */
function toIpv4String(hi: number, lo: number): string {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.')
}

/**
 * IPv6 私有 / 环回 / 链路本地 / ULA / 组播，含 IPv4 映射地址。
 *
 * 只在**确实是 IPv6 字面量**（含冒号）时才判断。
 * 早先的实现用 `startsWith('fc')` 直接判断，会把 fc.example.com、fcc.gov
 * 这类正常域名误杀 —— 那是 bug，不是安全。
 */
function isBlockedIpv6(host: string): boolean {
  if (!host.includes(':')) return false

  const g = expandIpv6(host)
  if (g === null) return true // 解析不了就拒绝

  const allZeroExceptLast = g.slice(0, 7).every((n) => n === 0)
  if (allZeroExceptLast && (g[7] === 0 || g[7] === 1)) return true // :: 与 ::1

  // IPv4 映射 ::ffff:a.b.c.d（可能是十六进制形式）
  const ipv4Mapped = g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff
  // IPv4 兼容（已废弃）::a.b.c.d
  const ipv4Compat = g.slice(0, 6).every((n) => n === 0) && (g[6] !== 0 || g[7] !== 0)
  if (ipv4Mapped || ipv4Compat) {
    return isBlockedIpv4(toIpv4String(g[6], g[7]))
  }

  const first = g[0]
  if (first >= 0xfe80 && first <= 0xfebf) return true // 链路本地 fe80::/10
  if (first >= 0xfc00 && first <= 0xfdff) return true // ULA fc00::/7
  if (first >= 0xff00) return true // 组播 ff00::/8

  return false
}

/**
 * 是否允许作为出站请求目标。
 *
 * 规则：只允许 http / https，且 host 不能是本机、环回、私有或保留地址。
 * 若确实需要访问内网地址（例如自建内网服务），应当显式改写这里，
 * 而不是把校验绕过。
 */
export function isAllowedHttpUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  // 去掉 IPv6 字面量的方括号
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return false

  if (host === 'localhost' || host.endsWith('.localhost')) return false
  if (host.endsWith('.local')) return false // mDNS
  if (host.endsWith('.internal')) return false

  if (isBlockedIpv4(host)) return false
  if (isBlockedIpv6(host)) return false

  return true
}
