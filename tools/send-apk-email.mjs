/**
 * 把 APK 作为附件发送到指定邮箱。
 *
 * 为什么自己实现 SMTP 而不用 nodemailer：
 *   nodemailer 会成为一个新的项目依赖，而这里只需要「SSL + AUTH LOGIN + 一个附件」
 *   这一条路径。用 Node 内置的 tls 模块实现，依赖为零。
 *   代价是要自己处理 MIME 编码，所以下面把每个细节都写了注释。
 *
 * 凭据全部从环境变量读，**不写入任何文件**：
 *   SMTP_HOST  默认 smtp.qq.com
 *   SMTP_PORT  默认 465（SSL）
 *   SMTP_USER  发件邮箱，如 xxx@qq.com
 *   SMTP_PASS  邮箱授权码（不是登录密码）
 *   MAIL_TO    收件人，逗号分隔
 *   MAIL_SUBJECT 可选，默认带版本号
 *
 * 用法：
 *   SMTP_USER=... SMTP_PASS=... MAIL_TO=... node tools/send-apk-email.mjs
 *   node tools/send-apk-email.mjs --dry-run     # 只组装邮件并打印大小，不发送
 */

import { connect } from 'node:tls'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APK = join(ROOT, 'release', 'app-debug.apk')
const DRY_RUN = process.argv.includes('--dry-run')

const HOST = process.env.SMTP_HOST?.trim() || 'smtp.qq.com'
const PORT = Number(process.env.SMTP_PORT?.trim() || 465)
const USER = process.env.SMTP_USER?.trim() || ''
const PASS = process.env.SMTP_PASS?.trim() || ''
const TO = (process.env.MAIL_TO || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function fail(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

// dry-run 只组装邮件，不连 SMTP，所以不需要凭据
if (!DRY_RUN) {
  if (!USER || !PASS) fail('缺少 SMTP_USER 或 SMTP_PASS（授权码）。见本文件头部说明。')
  if (TO.length === 0) fail('缺少 MAIL_TO。')
}

// ---------- MIME 组装 ----------

/** RFC 2047 B 编码，用于含非 ASCII 的邮件头（如中文主题） */
function encodeHeader(text) {
  // 纯 ASCII 不必编码，编码反而影响可读性
  if (/^[\x20-\x7e]*$/.test(text)) return text
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`
}

/** RFC 2822 日期，如 Tue, 22 Sep 2026 23:40:00 +0800 */
function rfc2822Date(d = new Date()) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const p = (n) => String(n).padStart(2, '0')
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const oh = p(Math.floor(Math.abs(offset) / 60))
  const om = p(Math.abs(offset) % 60)
  return (
    `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${sign}${oh}${om}`
  )
}

/**
 * base64 按 76 字符折行 + CRLF。
 *
 * 这里不需要做 SMTP 的 dot-stuffing：base64 字母表是 A-Za-z0-9+/=，
 * 不含 '.'，所以不会产生以 '.' 开头的行。
 */
function base64Lines(buf) {
  const s = buf.toString('base64')
  const lines = []
  for (let i = 0; i < s.length; i += 76) lines.push(s.slice(i, i + 76))
  return lines.join('\r\n')
}

const appVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
const subject = process.env.MAIL_SUBJECT?.trim() || `职业探索 App 安装包 v${appVersion}`

const boundary = `----career-explore-${Date.now().toString(36)}`

const bodyText = [
  `职业探索 App v${appVersion} 安装包，见附件。`,
  '',
  '安装方式：',
  '  1. 把 app-debug.apk 传到 Android 手机',
  '  2. 点击安装（首次需允许「安装未知来源应用」）',
  '  3. 或连接电脑后执行：adb install -r app-debug.apk',
  '',
  `包名：com.career.explore`,
  `SHA256：${process.env.APK_SHA256 || '(见 release/app-debug.apk 旁的构建记录)'}`,
  '',
  '说明：这是 debug 签名包，仅供测试，不能上架应用商店。',
].join('\r\n')

const apkBuf = readFileSync(APK)
const apkName = basename(APK)

const message = Buffer.concat([
  Buffer.from(
    [
      `From: ${encodeHeader('职业探索')} <${USER}>`,
      `To: ${TO.join(', ')}`,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${rfc2822Date()}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Lines(Buffer.from(bodyText, 'utf8')),
      '',
      `--${boundary}`,
      `Content-Type: application/vnd.android.package-archive; name="${apkName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${apkName}"`,
      '',
      '',
      '',
    ].join('\r\n'),
    'utf8'
  ),
  Buffer.from(base64Lines(apkBuf), 'utf8'),
  Buffer.from(`\r\n\r\n--${boundary}--\r\n`, 'utf8'),
])

const sizeMB = (message.length / 1024 / 1024).toFixed(1)

console.log('=== 发送 APK 邮件 ===')
console.log(`  SMTP    ${HOST}:${PORT} (SSL)`)
console.log(`  发件人  ${USER}`)
console.log(`  收件人  ${TO.join(', ')}`)
console.log(`  主题    ${subject}`)
console.log(`  附件    ${apkName}  ${(statSync(APK).size / 1024 / 1024).toFixed(1)} MB`)
console.log(`  邮件    ${message.length.toLocaleString('en-US')} 字节（${sizeMB} MB）`)

if (DRY_RUN) {
  console.log('\n--dry-run，未连接 SMTP、未发送。')
  process.exit(0)
}

// ---------- SMTP 会话 ----------

const socket = connect({ host: HOST, port: PORT, servername: HOST })

/** 已收到的数据缓冲；按行解析 SMTP 应答 */
let buffer = ''
let pending = null

/**
 * 等待一个「最终应答行」。
 *
 * SMTP 多行应答形如：
 *   250-最后一行之前
 *   250 最后一行
 * 所以要忽略 3 位码后面跟 '-' 的续行，只在跟空格时resolve。
 */
function readReply() {
  return new Promise((res, rej) => {
    pending = { res, rej }
    tryFlush()
  })
}

function tryFlush() {
  if (!pending) return
  const lines = buffer.split('\r\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\d{3} /.test(line)) {
      const code = Number(line.slice(0, 3))
      // 保留剩余数据
      buffer = lines.slice(i + 1).join('\r\n')
      const { res } = pending
      pending = null
      res({ code, text: line })
      return
    }
  }
}

socket.setEncoding('utf8')
socket.on('data', (chunk) => {
  buffer += chunk
  tryFlush()
})
socket.on('error', (e) => fail(`连接失败：${e.message}`))
// 大附件传输需要时间，给足超时
socket.setTimeout(180000, () => fail('SMTP 超时（180 秒）'))

async function send(line) {
  return new Promise((res, rej) => {
    socket.write(line + '\r\n', (err) => (err ? rej(err) : res()))
  })
}

/** 断言应答码，失败时把服务器原话带出来 —— 排查问题时这行最关键 */
async function expect(codes, what) {
  const reply = await readReply()
  if (!codes.includes(reply.code)) {
    fail(`${what} 失败：服务器返回 ${reply.code} ${reply.text}`)
  }
  return reply
}

async function main() {
  await expect([220], '连接')
  console.log('\n  已连接，开始握手')

  await send(`EHLO ${USER.split('@')[1] || 'localhost'}`)
  await expect([250], 'EHLO')

  // AUTH LOGIN：先发命令，再依次发 base64(用户名)、base64(授权码)
  await send('AUTH LOGIN')
  await expect([334], 'AUTH LOGIN')

  await send(Buffer.from(USER, 'utf8').toString('base64'))
  await expect([334], 'AUTH 用户名')

  await send(Buffer.from(PASS, 'utf8').toString('base64'))
  await expect([235], 'AUTH 授权码')

  console.log('  认证通过')

  await send(`MAIL FROM:<${USER}>`)
  await expect([250], 'MAIL FROM')

  for (const rcpt of TO) {
    await send(`RCPT TO:<${rcpt}>`)
    await expect([250, 251], `RCPT TO ${rcpt}`)
  }

  await send('DATA')
  await expect([354], 'DATA')

  console.log(`  正在上传 ${sizeMB} MB…`)

  // 逐条 write 会按顺序进入同一个 TCP 流，不需要额外同步。
  // 等回调（数据交给内核）再发结束标记，避免大数据被截断。
  await new Promise((res, rej) => {
    socket.write(message, (err) => (err ? rej(err) : res()))
  })

  // message 末尾已是 CRLF，所以这里补 ".\r\n" 即构成 SMTP 要求的 CRLF.CRLF
  await send('.')
  await expect([250], '发送正文')

  await send('QUIT')
  console.log('  服务器已接收')

  socket.end()
}

main()
  .then(() => {
    console.log('\n=== 发送成功 ===')
    console.log(`  ${TO.join(', ')}`)
    process.exit(0)
  })
  .catch((e) => fail(e?.message ?? String(e)))
