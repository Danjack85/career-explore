# 项目规则

本文件是本项目的 AI agent 工作约定。任何 agent 动手前先读本文件。

## 定位

给 20-25 岁大学生 / 应届生的职业探索 App。帮用户用低成本实验找到下一步。

不是职业规划鸡汤，不是招聘，不是测评算命。

## 技术栈

Vue3 + Vite + TypeScript + pnpm + Capacitor Android + Supabase(可选)。

- 路由：vue-router（hash 模式，便于打包进 APK）。
- 状态：`ref` + `localStorage`，**不引入 Pinia**。
- 样式：手写 SCSS，**不用 UI 库**。
- 图标：emoji 或内联 SVG。
- 数据：默认走本地 mock，`src/api/*` 为统一出口，Supabase 仅预留接口。
- 包名：`com.career.explore`。

## 工作方式

1. **一次一任务。** 任务来自 `docs/TASKS.md`，细则在 `docs/tasks/`。
2. **只改任务指定文件。** 卡外文件不动；确需变更，先说明理由。
3. **不擅自改数据结构。** `docs/SCHEMA.md` 是唯一权威。
4. **不引入大依赖。** 需要新依赖先说明用途和体积。
5. **完成后运行 `pnpm lint && pnpm build`。** 两个都过才算完成。
6. **更新 `docs/TASKS.md`。** 把任务在待办 / 进行中 / 已完成之间移动。
7. **输出变更摘要、测试结果、下一步。**

## 阻塞处理

遇到以下情况：需要密钥、需要人工决策、环境装不上、同一问题连续两次失败。

处理顺序：

1. **先尝试自动解决**（换方案、用缓存、查日志定位真因）。
2. 仍不通则写入 `docs/BLOCKED.md` 并**停止**，内容包含：缺什么、怎么装、装完执行什么命令。
3. 不允许为绕过阻塞而伪造结果（如伪造 APK 产物、伪造构建成功日志）。

## 禁止

- 不提交 `.env` 或密钥。
- 不伪造行业数据。无来源的结论写「待核实」，不编造数字。
- 不把测评写成诊断或算命。
- 不做任务卡外功能（不顺手重构、不顺手加页面、不顺手升依赖）。

## 文档地图

| 文件 | 作用 |
| --- | --- |
| `docs/PRD.md` | 定位、范围、指标 |
| `docs/FLOW.md` | 主流程与实验闭环 |
| `docs/SCHEMA.md` | 数据结构（唯一权威） |
| `docs/DESIGN.md` | 视觉与组件规范 |
| `docs/TASKS.md` | 任务总表与状态 |
| `docs/tasks/Txx-*.md` | 单任务范围与验收 |
| `docs/ENV.md` | 环境自检记录 |
| `docs/ANDROID.md` | Android 打包环境要求 |
| `docs/INFO_FEED.md` | 信息雷达的数据来源与更新机制 |
| `docs/BUILD.md` | APK 产物记录 |
| `docs/BLOCKED.md` | 阻塞说明（仅在阻塞时创建） |
