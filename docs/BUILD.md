# BUILD — APK 产物记录

## 最新产物（v0.2.0）

| 项 | 值 |
| --- | --- |
| 文件 | `release/app-debug.apk` |
| 来源 | `android/app/build/outputs/apk/debug/app-debug.apk` |
| 大小 | 4,375,943 字节（约 4.2 MB） |
| SHA256 | `1b6f9c4b5cd1f50f3f405b47e59c177763dc2f8787bf311db13fa3d5b6004a89` |
| 构建时间 | 2026-09-22 23:26（本地时间） |
| 包名 | `com.career.explore` |
| 应用名 | 职业探索 |
| 版本 | versionCode 2 / versionName 0.2.0 |
| minSdk / targetSdk | 24 / 36 |
| 类型 | debug（debug 签名，不可用于上架） |

v0.2.0 相对 v0.1.0 的变化：返回键行为修复、行业详情→实验出口、测评草稿、
应用图标与启动页、深色模式主题修正、窄屏可点面积修复、版本号对齐、
信息雷达接入真实数据源与热更新机制。详见 `docs/TASKS.md` 的 T11–T13。

### 历史版本

| 版本 | 大小 | SHA256 |
| --- | --- | --- |
| 0.1.0 | 4,202,444 字节 | `b5ee3c150be97340c8b0f100814ba9c36b324eed1871bdf5a7be0d74bca46cb8` |

校验：

```bash
sha256sum release/app-debug.apk
```

## 一键打包

```bash
pnpm apk                    # 完整流程：前端构建 → cap sync → Gradle → 校验 → 归集
pnpm apk:skip-web           # 跳过 pnpm build（dist 已是最新时）
node tools/build-apk.mjs --skip-sync   # 跳过 cap sync（只改了原生配置时）
node tools/build-apk.mjs --dry-run     # 只打印将要执行的步骤
```

脚本 `tools/build-apk.mjs` 固化了三个每次都会踩的坑：

1. **自动挑 JDK**。Capacitor 8 的 android 模块要求 Java 21 源码级别，用 JDK 17 会报
   `无效的源发行版：21`；本机 PATH 里还有 Oracle Java 8。脚本会扫描常见 JDK 安装位置，
   取**最低的合格版本**（21 上 Gradle 验证最充分），并在子进程里把它的 `bin` 放到 PATH 最前。
   已实测：即使 `JAVA_HOME` 被指向 JDK 8 或 17，脚本仍会正确选中 21。
2. **强制 cap sync**，并在打包后**校验 APK 内资源与 `dist/` 逐一致**
   （Vite 的哈希文件名即内容指纹）。这道防线防的是「忘了 sync 打出白屏包」。
   校验在复制进 `release/` **之前**执行 —— 否则失败时会把好包覆盖成坏包。
   已实测：故意删掉一个资源后打包，脚本以退出码 1 失败、指明缺哪个文件，
   且 `release/` 里的好包未被覆盖。
3. **检查版本号**是否与 `package.json` 一致（这个漂移以前出现过）。

> **关于哈希可复现性**：输入完全不变时，连续打包哈希稳定（实测 3 次一致）。
> 但**重新执行 `cap sync` 会改变哈希** —— 它重新拷贝文件、更新了 zip 条目里的时间戳。
> 所以哈希是「这个产物的指纹」，不是「这个源码版本必然的指纹」；
> 换个人重新构建得到不同哈希是正常的，逐字节一致需要构建过程本身可复现（当前不保证）。

## 手动复现（脚本不可用时）

```bash
# 1) 前端产物
pnpm build

# 2) 同步进 Android 工程
npx cap sync android

# 3) 打包（必须用 JDK 21，见下）
export JAVA_HOME="E:/MC/JAVA/21"
cd android && ./gradlew assembleDebug

# 4) 取产物
cp android/app/build/outputs/apk/debug/app-debug.apk release/app-debug.apk
```

## 本次构建的两处环境调整

1. **JDK 换成 21**。
   Capacitor 8 的 `capacitor-android` 模块以 Java 21 为源码级别，用 JDK 17 构建会报
   `错误: 无效的源发行版：21`。本机 `E:/MC/JAVA/21`（21.0.10 LTS）可用。
2. **`android/gradle.properties` 增加 `android.overridePathCheck=true`**。
   本工程路径含中文（`九月项目`），AGP 默认拒绝构建。该检查针对 aapt2 / NDK 在非 ASCII
   路径下的历史问题；本工程无原生代码，实测可正常打包。
   若后续引入原生模块后出现资源或编码错误，应把工程移到纯 ASCII 路径。

另：`android/gradle/wrapper/gradle-wrapper.properties` 的发行版由 `-all` 改为 `-bin`，
因为本机已缓存 `gradle-8.14.3-bin` 且访问 services.gradle.org 超时；两者构建行为一致。

## APK 内容抽查

| 检查 | 结果 |
| --- | --- |
| `assets/public/` 文件数 | 34 |
| 含 `index.html` / `cordova.js` | 是 |
| 含各页面分包（Home / IndustryList / Assessment / …） | 是 |
| 资源路径为相对路径（`./assets/...`） | 是，适配 WebView 的 file:// 加载 |

## 安装方式

```bash
adb install -r release/app-debug.apk
```

或把 APK 传到手机后点击安装（需允许「安装未知来源应用」）。

## 已在模拟器上实测通过的项目

v0.2.0 安装到 Android 模拟器（API 35，x86_64）后逐项验证：

| 项目 | 结果 |
| --- | --- |
| 安装与启动 | 成功，无崩溃 |
| 首页四个卡点入口 | 点击跳转正常 |
| 底部导航 | 四项切换、当前项高亮正常 |
| 行业列表 → 详情 | 卡片进入详情，字段完整 |
| **硬件返回键（详情页）** | 回到行业列表，**未退出应用** |
| **硬件返回键（首页）** | 退出到桌面（符合平台习惯） |
| **行业详情 → 加入实验** | 创建 7 天实验并跳转详情，标题/方向/假设正确 |
| 应用图标 | 应用信息页显示新图标，非 Capacitor 默认图标 |
| 启动页 | 冷启动显示白底 + 蓝色标记 |
| APK 内资源 | 与 `dist/` 的 31 个文件逐一对齐（哈希文件名即内容指纹） |
| INTERNET 权限 | `aapt2 dump permissions` 确认存在 |
| **系统深色模式下渲染** | 开启夜间模式后仍为白底深灰字，配色未被反转 |
| **信息雷达真实数据** | 显示教育部 / 国家统计局的真实条目、来源等级「官方数据」、发布日期、原文链接 |
| **信息雷达批注** | 打开表单 → 输入 → 保存 → 卡片显示批注，出现「修改我的批注」 |
| **筛选 chip 组件** | 行业列表（按阶段）与信息雷达（按标签）筛选均正常，无障碍分组名正确 |
| **行业卡片真实来源** | 新能源卡片显示「国家统计局 / 官方数据 / 统计数据」+ 两条原文原句 + 数据日期 + 查看原文 |
| **行业卡片无来源态** | 游戏等卡片显示具体原因，无链接、无编造内容 |
| **事实与判断分离** | 卡片明示「数字是事实；阶段、风险点是编辑判断」，分区显示 |
| 资源对齐 | APK 内资源与 `dist/` 逐一对齐；`FilterChips`、feed 与证据文件确认在包内 |

窄屏与可点面积（T12）用浏览器在 320 / 360 / 390px 三个宽度逐页测量：
8 个页面均无横向溢出；7 天网格、输入框、能量按钮、来源链接均已达到或接近 44px。

## 把 APK 发到邮箱

```bash
pnpm build-apk   # 先出包（等价于 node tools/build-apk.mjs）
SMTP_USER=发件邮箱 SMTP_PASS=授权码 MAIL_TO=收件邮箱 pnpm send-apk
```

`tools/send-apk-email.mjs` 用 Node 内置 `tls` 直接跟 SMTP 对话，
**不引入 nodemailer**（只用到「SSL + AUTH LOGIN + 一个附件」这一条路径）。

凭据全部走环境变量，**不写入任何文件**：

| 变量 | 说明 |
| --- | --- |
| `SMTP_HOST` | 默认 `smtp.qq.com` |
| `SMTP_PORT` | 默认 `465`（SSL） |
| `SMTP_USER` | 发件邮箱 |
| `SMTP_PASS` | 邮箱**授权码**（不是登录密码） |
| `MAIL_TO` | 收件人，多个用逗号分隔 |
| `MAIL_SUBJECT` | 可选，默认带版本号 |

加 `--dry-run` 可只组装邮件并打印大小，不连 SMTP（此时不需要凭据）。

> QQ 邮箱的授权码在「设置 → 账户 → POP3/IMAP/SMTP 服务」里生成。
> 它等同于该邮箱的发信权限，**不要提交进仓库**；若已泄漏，去邮箱重置。
