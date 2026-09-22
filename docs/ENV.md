# ENV — 环境自检记录

检测时间：2026-09-21
平台：Windows 10.0.28000 x64，shell 为 Git Bash

## 自检结果

| 项目 | 命令 | 结果 | 状态 |
| --- | --- | --- | --- |
| Node | `node -v` | v24.19.0 | OK |
| pnpm | `pnpm -v` | 10.30.3 | OK |
| JDK | `java -version` | openjdk 17.0.16 (Zulu 17.60+17-CA) | OK |
| JDK 路径 | `where java` | `E:\MC\JAVA\zulu17\bin\java.exe` | OK |
| JAVA_HOME | `echo $JAVA_HOME` | **空** | 需处理 |
| ANDROID_HOME | `echo $ANDROID_HOME` | `F:\dev-cache\Android-Sdk-user` | OK |
| ANDROID_SDK_ROOT | `echo $ANDROID_SDK_ROOT` | `F:\dev-cache\Android-Sdk-user` | OK |
| gradle | `which gradle` | 不在 PATH | 可接受 |

结论：**JDK 与 Android SDK 均已就绪，无需安装。** 仅 `JAVA_HOME` 为空，Gradle 需要它，见下方处理方式。

## Android SDK 内容（`F:\dev-cache\Android-Sdk-user`）

| 组件 | 版本 |
| --- | --- |
| platforms | android-35、android-36 |
| build-tools | 34.0.0、35.0.0 |
| platform-tools | 有 `adb.exe` |
| cmdline-tools | latest |
| 其他 | ndk、emulator、system-images、licenses |

Android SDK 许可证目录已存在，说明本机此前完成过 SDK 安装。

## Gradle

系统 PATH 中没有 `gradle` 命令，但 **不需要全局 Gradle**：

- Capacitor 生成的 Android 工程自带 `gradlew` 包装器，用包装器即可。
- `~/.gradle/wrapper/dists` 已缓存以下发行版：8.1.1、8.4、8.7、8.9、8.13、8.14.3。
- `~/.gradle/android` 已存在，说明本机此前跑过 Android 构建。

因此 T10 大概率**不需要下载 Gradle 发行版**；若 Capacitor 模板要求的版本不在缓存中，包装器会自动下载（需网络）。

## 待处理：JAVA_HOME 为空

Gradle 通过 `JAVA_HOME` 定位 JDK，为空时会回退到 PATH 中的 `java`。由于 PATH 中第一个 `java` 就是 Zulu 17，多数情况下仍可工作，但为稳妥起见，执行 Android 构建时显式设置：

```bash
export JAVA_HOME="E:/MC/JAVA/zulu17"
export PATH="$JAVA_HOME/bin:$PATH"
```

注意 PATH 中还装有 Oracle Java 8（`C:\Program Files (x86)\Common Files\Oracle\Java\javapath`）。**Android Gradle Plugin 8.x 要求 JDK 17，用 Java 8 会直接构建失败**，所以构建时必须确保 JAVA_HOME 指向 Zulu 17。

## 磁盘空间

| 盘 | 可用 |
| --- | --- |
| C: | 63 GB |
| F: | 170 GB |

空间充足。

## 复现方式

```bash
node -v; pnpm -v
java -version
echo "[$JAVA_HOME]"
echo "[$ANDROID_HOME]"
ls "$ANDROID_HOME/platforms" "$ANDROID_HOME/build-tools"
```
