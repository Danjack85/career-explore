/**
 * 一键打包 APK。
 *
 * 把「前端构建 → 同步进 Android 工程 → Gradle 打包 → 归集产物 → 记录指纹」
 * 串成一条命令，并固化几个每次都会踩的坑：
 *
 *   1. **JDK 版本**。Capacitor 8 的 android 模块以 Java 21 为源码级别，
 *      用 JDK 17 会报「无效的源发行版：21」。本机 PATH 里还有 Oracle Java 8，
 *      所以必须显式指定 JAVA_HOME —— 脚本会自动挑一个合适的 JDK。
 *   2. **忘了 cap sync**。改完前端不 sync 就打，APK 里是旧代码。
 *      脚本强制跑 sync，并在打包后校验 APK 内的资源与 dist/ 一致。
 *   3. **版本号漂移**。package.json 和 build.gradle 曾经一个 0.1.0 一个 1.0。
 *      脚本会检查并警告。
 *
 * 用法：
 *   node tools/build-apk.mjs                    # 完整流程
 *   node tools/build-apk.mjs --skip-web         # 跳过 pnpm build（dist 已是最新时）
 *   node tools/build-apk.mjs --skip-sync        # 跳过 cap sync（只改了原生配置时）
 *   node tools/build-apk.mjs --dry-run          # 只打印将要执行的步骤
 *
 * 环境变量：
 *   JAVA_HOME  已指向 JDK 21+ 时直接使用，不再自行搜索
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANDROID_DIR = join(ROOT, 'android')
const DIST_DIR = join(ROOT, 'dist')
const RELEASE_DIR = join(ROOT, 'release')
const APK_OUT = join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const APK_RELEASE = join(RELEASE_DIR, 'app-debug.apk')

// pnpm 会把 `pnpm apk -- --dry-run` 里的 `--` 原样传进来，过滤掉避免干扰
const args = process.argv.slice(2).filter((a) => a !== '--')
const SKIP_WEB = args.includes('--skip-web')
const SKIP_SYNC = args.includes('--skip-sync')
const DRY_RUN = args.includes('--dry-run')

const isWin = process.platform === 'win32'
const log = (msg) => console.log(msg)
const step = (n, msg) => console.log(`\n[${n}] ${msg}`)

/**
 * 执行命令，实时输出，失败即抛出。
 *
 * Windows 上不能用 `shell: true` 传参数组（Node 会警告参数未转义）；
 * 而 .bat/.cmd 又必须经 cmd.exe 才能执行，所以显式走 `cmd.exe /c`。
 * 已实测本机路径含中文时 cmd.exe /c 仍能正确定位 gradlew.bat。
 */
function run(cmd, cmdArgs, opts = {}) {
  const [file, fileArgs] =
    isWin && !/\.exe$/i.test(cmd) ? ['cmd.exe', ['/c', cmd, ...cmdArgs]] : [cmd, cmdArgs]

  if (DRY_RUN) {
    log(`    (dry-run) ${file} ${fileArgs.join(' ')}`)
    return ''
  }
  return execFileSync(file, fileArgs, {
    cwd: opts.cwd ?? ROOT,
    stdio: opts.quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...(opts.env ?? {}) },
  })
}

// ---------- JDK 探测 ----------

/**
 * 读 javac 的主版本号。
 * 注意 `javac -version` 输出形如 "javac 21.0.10"，早期版本是 "javac 1.8.0_271"。
 */
function javacMajor(binPath) {
  try {
    const out = execFileSync(binPath, ['-version'], { encoding: 'utf8', stdio: 'pipe' })
    const m = /javac\s+(\d+)(?:\.(\d+))?/.exec(out + '')
    if (!m) return null
    const first = Number(m[1])
    // 1.8.0 → 8
    return first === 1 ? Number(m[2]) : first
  } catch {
    return null
  }
}

function findJdks() {
  const roots = []

  if (process.env.JAVA_HOME) roots.push({ dir: process.env.JAVA_HOME, from: 'JAVA_HOME' })

  if (isWin) {
    for (const base of [
      'E:/MC/JAVA',
      'D:/MC/JAVA',
      'C:/Program Files/Java',
      'C:/Program Files/Eclipse Adoptium',
      'C:/Program Files/Microsoft',
      'C:/Program Files/Zulu',
      'C:/Program Files/Android/Android Studio/jbr',
    ]) {
      if (!existsSync(base)) continue
      // 目录本身可能就是 JDK
      roots.push({ dir: base, from: 'scan' })
      try {
        for (const name of readdirSync(base)) {
          roots.push({ dir: join(base, name), from: 'scan' })
        }
      } catch {
        /* 读不了就跳过 */
      }
    }
  } else {
    for (const base of ['/usr/lib/jvm', '/opt/java', join(homedir(), '.sdkman/candidates/java')]) {
      if (!existsSync(base)) continue
      try {
        for (const name of readdirSync(base)) roots.push({ dir: join(base, name), from: 'scan' })
      } catch {
        /* 同上 */
      }
    }
  }

  const found = []
  for (const { dir } of roots) {
    const bin = join(dir, 'bin', isWin ? 'javac.exe' : 'javac')
    if (!existsSync(bin)) continue
    const major = javacMajor(bin)
    if (major === null) continue
    found.push({ home: dir, major })
  }
  return found
}

/** Capacitor 8 要求 Java 21 源码级别 */
const MIN_JDK = 21

function pickJdk() {
  const all = findJdks()
  if (all.length === 0) {
    throw new Error(
      '找不到任何可用的 JDK。请安装 JDK 21（如 Zulu/Temurin），并设置 JAVA_HOME 后重试。'
    )
  }

  const ok = all.filter((j) => j.major >= MIN_JDK)
  if (ok.length === 0) {
    const list = all.map((j) => `${j.major} (${j.home})`).join('\n      ')
    throw new Error(
      `需要 JDK ${MIN_JDK} 或以上，但只找到：\n      ${list}\n` +
        '  装一个 JDK 21，或把 JAVA_HOME 指向已有的高版本 JDK。'
    )
  }

  // 取**最低的合格版本**：AGP 8.13 / Gradle 8.14 在 21 上验证最充分，
  // 更高的版本（如 25）可能超出 Gradle 支持范围。
  ok.sort((a, b) => a.major - b.major)
  return ok[0]
}

// ---------- 前置检查 ----------

function checkVersions() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const gradle = readFileSync(join(ANDROID_DIR, 'app', 'build.gradle'), 'utf8')
  const m = /versionName\s+"([^"]+)"/.exec(gradle)
  const gradleVersion = m ? m[1] : null

  if (gradleVersion && gradleVersion !== pkg.version) {
    log(
      `    ⚠ 版本号不一致：package.json 是 ${pkg.version}，` +
        `android/app/build.gradle 是 ${gradleVersion}`
    )
    log('      （APK 里显示的是 build.gradle 的值，建议先对齐）')
  } else if (gradleVersion) {
    log(`    版本 ${pkg.version}（package.json 与 build.gradle 一致）`)
  }
}

/** 校验 APK 内的网页资源与 dist/ 一致 —— 哈希文件名即内容指纹 */
function verifyAssets() {
  const apkAssets = listApkAssets()
  const distAssets = readdirSync(join(DIST_DIR, 'assets')).sort()

  if (apkAssets.length === 0) {
    throw new Error('APK 里没有找到网页资源，assets/public 可能是空的（cap sync 未生效？）')
  }

  const missing = distAssets.filter((f) => !apkAssets.includes(f))
  const extra = apkAssets.filter((f) => !distAssets.includes(f))

  if (missing.length || extra.length) {
    throw new Error(
      'APK 内资源与 dist/ 不一致，说明打包时用的不是当前构建产物：\n' +
        (missing.length ? `    dist 里有但 APK 里没有：${missing.join(', ')}\n` : '') +
        (extra.length ? `    APK 里有但 dist 里没有：${extra.join(', ')}\n` : '')
    )
  }
  return apkAssets.length
}

/** 用 jar/unzip 之外的纯 node 方式读 zip 列表：直接扫 central directory */
function listApkAssets() {
  const buf = readFileSync(APK_OUT)
  const names = []
  // End of central directory record
  let eocd = buf.length - 22
  while (eocd > 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd <= 0) return names

  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)

  for (let i = 0; i < count && off + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    if (name.startsWith('assets/public/assets/')) {
      names.push(name.slice('assets/public/assets/'.length))
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return names.sort()
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function human(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ---------- 主流程 ----------

function main() {
  log('=== 一键打包 APK ===')
  if (DRY_RUN) log('（dry-run：只打印步骤，不实际执行）')

  step(1, '检查环境')
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const jdk = pickJdk()
  log(`    项目版本 ${pkg.version}`)
  log(`    JDK ${jdk.major}  →  ${jdk.home}`)
  const env = { JAVA_HOME: jdk.home }
  // 把选中的 JDK 放到 PATH 最前，避免 PATH 里的 Java 8 被优先命中
  env.PATH = `${join(jdk.home, 'bin')}${isWin ? ';' : ':'}${process.env.PATH ?? ''}`
  checkVersions()

  step(2, '构建前端（vite build → dist/）')
  if (SKIP_WEB) {
    log('    已指定 --skip-web，跳过')
    if (!existsSync(join(DIST_DIR, 'index.html'))) {
      throw new Error('dist/ 不存在或不完整，不能跳过前端构建')
    }
  } else {
    run('pnpm', ['build'])
  }

  step(3, '同步进 Android 工程（cap sync）')
  if (SKIP_SYNC) {
    const syncedDir = join(ANDROID_DIR, 'app', 'src', 'main', 'assets', 'public')
    if (!existsSync(syncedDir)) {
      // 构建产物不入库，也可能是刚被清理过。这种情况必须 sync，否则打出空壳包。
      throw new Error(
        '--skip-sync 无效：android/app/src/main/assets/public 不存在。\n' +
          '  该目录是 cap sync 的产物、不入库，请去掉 --skip-sync 重新执行。'
      )
    }
    log('    已指定 --skip-sync，跳过')
  } else {
    run('pnpm', ['exec', 'cap', 'sync', 'android'])
  }

  step(4, 'Gradle 打包（assembleDebug）')
  const gradleCmd = isWin ? join(ANDROID_DIR, 'gradlew.bat') : join(ANDROID_DIR, 'gradlew')
  run(gradleCmd, ['assembleDebug'], { cwd: ANDROID_DIR, env })

  step(5, '校验产物')
  if (DRY_RUN) {
    log('    (dry-run) 跳过校验')
  } else {
    if (!existsSync(APK_OUT)) {
      throw new Error(`Gradle 未产出 APK：${APK_OUT}`)
    }
    // 先校验 Gradle 的产物，再复制进 release/。
    // 顺序反过来的话，校验失败会把 release/ 里那个好包覆盖成坏包 —— 而坏包看起来是正常的。
    const assetCount = verifyAssets()
    log(`    ✓ APK 内网页资源与 dist/ 一致（${assetCount} 个文件）`)
  }

  step(6, '归集到 release/')
  if (DRY_RUN) {
    log('    (dry-run) 跳过复制')
    return
  }
  mkdirSync(RELEASE_DIR, { recursive: true })
  copyFileSync(APK_OUT, APK_RELEASE)

  const size = statSync(APK_RELEASE).size
  const hash = sha256(APK_RELEASE)

  log('\n=== 完成 ===')
  log(`  产物    release/app-debug.apk`)
  log(`  大小    ${size.toLocaleString('en-US')} 字节（${human(size)}）`)
  log(`  SHA256  ${hash}`)
  log(`  版本    ${pkg.version}`)
  log(`  JDK     ${jdk.major} (${jdk.home})`)
  log('\n  安装：adb install -r release/app-debug.apk')
  log('  记得把上面的 SHA256 记到 docs/BUILD.md')
}

try {
  main()
} catch (e) {
  console.error(`\n✗ 打包失败：${e.message}`)
  process.exit(1)
}
