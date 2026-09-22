# ANDROID — Android 打包环境与工程说明

本文件记录把 H5 打成 Android APK 的环境要求、工程结构与操作步骤。
环境自检结果见 `docs/ENV.md`，产物记录见 `docs/BUILD.md`。

## 环境要求

| 组件 | 要求 | 本机状态 |
| --- | --- | --- |
| JDK | **17 或以上**（AGP 8.13 最低 17） | Zulu 17.0.16，路径 `E:\MC\JAVA\zulu17` |
| JAVA_HOME | 必须指向 JDK 17+ | **默认未设置，构建时显式指定** |
| Android SDK | 需 platforms `android-36`、build-tools `35.0.0` | 已具备，`F:\dev-cache\Android-Sdk-user` |
| ANDROID_HOME | 指向 SDK 根目录 | 已设置 |
| Gradle | 用工程自带 `gradlew`，无需全局安装 | 8.14.3，发行版已在本机 Gradle 缓存中 |
| Node | ≥ 22（Capacitor 8 要求） | v24.19.0 |

### 关键坑位

1. **Java 版本冲突**：本机 PATH 中存在 Oracle Java 8。AGP 8.x 用 Java 8 会直接失败。
   构建前必须设置 `JAVA_HOME` 指向 Zulu 17。
2. 本机另有 JDK 25，但 Gradle 8.14 对 JDK 25 支持不完整，**建议固定用 17**。
3. SDK 路径含 `platforms/android-36`，与工程 `compileSdkVersion = 36` 对应；缺这个包会导致构建失败。

## 工程结构（`android/`）

```
android/
├── app/
│   ├── build.gradle                    应用模块配置（applicationId / 版本号）
│   ├── src/main/
│   │   ├── AndroidManifest.xml         含 INTERNET 权限
│   │   ├── assets/public/              ← pnpm build 产出的 dist 被拷到这里
│   │   └── java/com/career/explore/    MainActivity
│   └── capacitor.build.gradle
├── build.gradle                        AGP 8.13.0
├── variables.gradle                    minSdk 24 / compileSdk 36 / targetSdk 36
├── gradle/wrapper/                     Gradle 8.14.3
└── gradlew, gradlew.bat
```

要点：**Web 代码不直接构建，而是由 `cap sync` 从 `dist/` 拷进 `assets/public/`**。
所以改完前端必须先 `pnpm build` 再 `cap sync`，否则 APK 里是旧代码。

`android/app/src/main/assets/public/` 被 Capacitor 自带的 `.gitignore` 忽略，仓库里不含它。
**因此新克隆的仓库必须先 `pnpm build && npx cap sync android`，才能直接跑 gradle**，
否则打出来的 APK 没有网页内容（白屏）。

## 操作步骤

**推荐用一键脚本**（自动挑 JDK、强制 sync、校验资源一致性）：

```bash
pnpm apk
```

等价于下面四步。脚本不可用时手动执行：

```bash
# 1. 前端构建（产出 dist/）
pnpm build

# 2. 同步到 Android 工程
npx cap sync android

# 3. 打包 debug APK（注意 JAVA_HOME）
export JAVA_HOME="E:/MC/JAVA/21"
cd android && ./gradlew assembleDebug
```

产物路径：`android/app/build/outputs/apk/debug/app-debug.apk`

Windows 下如果 `./gradlew` 不可执行，用 `cmd //c gradlew.bat assembleDebug`。

> **JDK 必须是 21 或以上**。Capacitor 8 的 android 模块以 Java 21 为源码级别，
> 用 JDK 17 会报 `无效的源发行版：21`。`pnpm apk` 会自动挑一个合格 JDK，
> 手动执行时记得先设 `JAVA_HOME`。

## 配置项

| 项 | 值 |
| --- | --- |
| 应用名 | 职业探索 |
| 包名（applicationId） | `com.career.explore` |
| 版本 | versionName `0.2.0` / versionCode `2`（与 `package.json` 保持一致） |
| webDir | `dist`（与 `vite.config.ts` 的 `build.outDir` 一致） |
| base | `'./'`（WebView 按相对路径加载资源，必须） |
| 路由 | hash 模式（不依赖服务端重写规则） |
| 权限 | `android.permission.INTERNET`（模板默认已含，用于将来接 Supabase） |

## 图标与启动页

图标是二进制资源，不手改，用脚本生成：

```bash
python tools/gen-icons.py       # 需要 Pillow
```

会覆盖 26 个资源：各密度（mdpi→xxxhdpi）的 `ic_launcher` / `ic_launcher_round` /
`ic_launcher_foreground`，以及横竖屏各密度的 `splash.png`。

设计约定（改脚本时注意）：

- 图形是一条基线上方的向上箭头，表达「下一步」而不是「登顶」，不做渐变和立体感。
- **自适应图标背景色在 `res/values/ic_launcher_background.xml`，必须是主色 `#2563EB`。**
  前景是白色图形，把背景改成浅色会让图形看不见。
- 启动页白底，`AppTheme.NoActionBarLaunch` 的 `windowSplashScreenBackground` 与之保持一致。

## 深色模式

应用是**纯浅色设计**（`docs/DESIGN.md`：白底深灰字，干净、务实），不支持深色主题。
三处配置共同保证这一点，改任何一处前先读这段：

| 位置 | 配置 | 作用 |
| --- | --- | --- |
| `index.html` | `<meta name="color-scheme" content="light" />` | 告诉浏览器只支持浅色，避免自动暗化 |
| `res/values/styles.xml` | `AppTheme.NoActionBar` 用 `Theme.AppCompat.Light.NoActionBar` | 让 `isLightTheme=true`，原生窗口背景不会变深 |
| `AndroidManifest.xml` | `android:forceDarkAllowed="false"`（API 29+） | 显式禁止算法性暗化（force dark） |

**不要把主题改回 `DayNight`**。用 DayNight 时 `isLightTheme=false`，
系统深色模式下 WebView 可能反转网页配色，原生窗口背景也会变深导致启动闪黑。

已实测：模拟器 `cmd uimode night yes` 后启动，配色仍为浅色，未被反转。

## 返回键行为

Capacitor 默认是**任何页面按返回键都退出应用**，这对多页应用是错的。
`src/utils/nativeBack.ts` 覆盖了这个行为：非首页回上一路由，首页才退出。
只在原生平台注册，浏览器里不生效（浏览器有自己的后退按钮）。

改动导航相关逻辑时注意别把这段注册删掉，否则子页面按返回会直接退出应用。

## 已知限制

- 只出 **debug** 包（用 debug 签名）。release 包需要签名配置，当前不做。
- 未配置深色模式、状态栏颜色等原生外观。
- `res/drawable-v24/ic_launcher_foreground.xml` 是模板残留的矢量前景，未被引用（实际生效的是
  `mipmap-*/ic_launcher_foreground.png`）。留着无害，可清理。
