# T02 — 数据结构与本地 mock 数据层

## 目标

本地 mock 数据层 + Supabase client 占位。**所有数据 API 走统一接口，无 Supabase 时自动降级到本地。**

## 文件

| 文件 | 说明 |
| --- | --- |
| `src/api/*.ts` | 统一数据接口（各表一个模块 + 统一出口） |
| `src/mock/*.ts` | mock 数据 |
| `src/utils/supabase.ts` | Supabase client 占位 |

## mock 要求

### industry_cards：10 条

人工智能应用、新能源、跨境电商、本地生活、企业服务SaaS、半导体、房地产、在线教育、传统媒体、游戏。

每条含 `docs/SCHEMA.md` 的全部字段：

- `salary_range` 无法确认的写 **「待核实」**
- `sources` 写 **「示例数据，需人工替换」**
- `source_date` 写 **「待核实」**
- `stage` 必须落在枚举内

### info_items：3 条

标注 `source_level`，文案注明 **「示例数据，需人工核实」**。

## 接口约定

- 每个模块导出读写函数，返回 `Promise`，签名与将来接 Supabase 时一致。
- 无 Supabase 配置时读 `src/mock/*`，写入 `localStorage`。
- 不在接口层暴露实现细节（页面只 import `src/api`）。

## 验收

- [ ] `pnpm build` 通过，`pnpm lint` 无错误
- [ ] 10 条行业数据字段完整，无编造薪资数字
- [ ] 3 条信息带来源等级
- [ ] 页面可通过 `src/api` 取到数据

## 输出

变更摘要、测试结果、下一步建议。
