# T10 — 构建 APK

## 目标

产出 `app-debug.apk`。

## 步骤

1. `cd android && ./gradlew assembleDebug`
   （本项目在 Git Bash 下用 `./gradlew`，Windows 下也可用 `cmd //c gradlew.bat assembleDebug`）
2. 若失败，检查 JDK / Android SDK / Gradle 并尝试自动修复
3. 成功后复制到项目根目录 `release/app-debug.apk`
4. 记录 APK 路径、大小、SHA256 到 `docs/BUILD.md`
5. 若环境无法打包，写 `docs/BLOCKED.md`，含：缺什么、怎么装、装完执行什么命令

## 构建前必做

先执行 `pnpm build`（产出 `dist/`），再 `npx cap sync android`，最后才 `gradlew assembleDebug`。顺序错了会打出旧代码。

## 环境要点

- **必须确保 JDK 17 生效**：`export JAVA_HOME="E:/MC/JAVA/zulu17"`。PATH 中存在 Oracle Java 8，AGP 8.x 用它必然失败。
- Gradle 用工程自带包装器，不要试图安装全局 gradle。

## 验收

- [ ] 存在 `release/app-debug.apk`，**或** `docs/BLOCKED.md` 有完整人工步骤
- [ ] `docs/BUILD.md` 记录路径 / 大小 / SHA256
- [ ] 不伪造产物：若构建失败，如实记录失败日志

## 输出

变更摘要、测试结果、下一步建议。
