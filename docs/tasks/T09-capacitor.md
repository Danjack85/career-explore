# T09 — Capacitor Android 初始化

## 目标

把 H5 构建成 Android 工程。

## 步骤

1. `pnpm add -D @capacitor/cli && pnpm add @capacitor/core @capacitor/android`
2. `npx cap init "职业探索" "com.career.explore" --web-dir=dist`
3. `vite.config.ts` 里 `build.outDir` 设为 `dist`，`base` 设为 `'./'`
4. `npx cap add android`
5. `npx cap sync android`
6. 配置 `android/app/src/main/AndroidManifest.xml` 加上 INTERNET 权限
7. 创建 `docs/ANDROID.md` 记录环境要求（JDK 17、Android SDK、Gradle）

## 环境要求（本机已具备，详见 `docs/ENV.md`）

| 组件 | 本机状态 |
| --- | --- |
| JDK | Zulu 17.0.16 已装；`JAVA_HOME` 为空，构建时需显式设置 |
| Android SDK | `F:\dev-cache\Android-Sdk-user`，含 platforms 35/36、build-tools 34/35 |
| Gradle | 无需全局安装，用工程自带 `gradlew`；`~/.gradle` 已缓存多个发行版 |

## 注意

- `base: './'` 与 hash 路由配合，避免打包后资源路径 404。
- Capacitor 的 `webDir` 必须与实际构建输出目录一致（`dist`）。

## 验收

- [ ] `android/` 目录生成
- [ ] `npx cap sync android` 成功
- [ ] `AndroidManifest.xml` 含 INTERNET 权限
- [ ] `docs/ANDROID.md` 已创建

## 输出

变更摘要、测试结果、下一步建议。
