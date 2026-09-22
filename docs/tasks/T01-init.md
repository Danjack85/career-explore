# T01 — 初始化项目骨架

## 目标

Vue3 + Vite + TypeScript + pnpm 项目骨架。

只做骨架，不做业务。

## 文件

| 文件 | 说明 |
| --- | --- |
| `package.json` | 依赖与 `lint` / `build` / `dev` 脚本 |
| `vite.config.ts` | Vite 配置 |
| `tsconfig.json` | TS 配置 |
| `index.html` | H5 入口 |
| `src/main.ts` | 应用启动 |
| `src/App.vue` | 根组件 |
| `src/router/index.ts` | vue-router 路由表 |
| `src/styles/variables.scss` | 设计变量（对齐 `docs/DESIGN.md`） |
| `.env.example` | 环境变量样例 |
| `.gitignore` | 忽略 node_modules / dist / .env |

### 页面空文件

```
src/views/Home.vue                 首页
src/views/IndustryList.vue         行业列表
src/views/IndustryDetail.vue       行业详情
src/views/Assessment.vue           测评
src/views/AssessmentResult.vue     测评结果
src/views/Info.vue                 信息雷达
src/views/Plan.vue                 计划
src/views/ExperimentList.vue       实验列表
src/views/ExperimentDetail.vue     实验详情
```

## 不做

- 不写业务逻辑（无接口调用、无数据处理）
- 不做 Capacitor（T09 才做）
- 不建数据层（T02 才做）
- 不引入大型 UI 库

## 验收

- [ ] `pnpm install` 成功
- [ ] `pnpm build` 成功
- [ ] 路由能跳转
- [ ] 不引入大型 UI 库

## 输出

变更摘要、测试结果、下一步建议。
