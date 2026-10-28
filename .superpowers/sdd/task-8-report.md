# Task 8 实施报告：文件提取、快速导入与每日精选

## 状态与范围

- 基线：`ea1cb66173fd607fd10413917c377972644187be`
- 状态：实施完成，聚焦测试、完整前端测试、lint、build 均通过。
- 变更仅限前端 Task 8 相关模块与本报告；未修改后端、既有后端 AI 接口、提示词配置或其他业务文档。

## 最新“AI 保留空白”约束落实

1. 未写入任何实际 AI 提示词、模型名、API Key、API Base 或新增 AI 配置值。
2. 未新增或调用 `/api/ai/status`、`/api/ai/doc-to-tasks`、`/api/ai/doc-to-tasks/import`、`/api/content/daily/refresh`。
3. “AI 智能分析”和“AI 换一批”均为明确标注“暂未配置”的禁用动作；旁边有说明，不伪装成远程失败，不展示伪造的 AI 分析或新精选。
4. 每日精选仅读取并展示已有 `GET /api/content/daily`；“刷新内容”只重新读取现有内容，不生成内容。
5. 本地快速识别在 UI 中明确标注为“简单规则”：仅按非空行拆分任务、清理常见列表符号并提取行内日期，不冒称 AI。
6. 文件提取继续使用现有 `POST /api/ai/extract-text`，它只是文本提取，不触发远程分析。
7. 任务预览不包含能力维度，页面也不展示 `matchedDimensions` 或能力评估入口。

## 功能实现

### 文件提取与导入

- QuickAddDrawer 增加“手动填写 / 文档导入”入口，DocumentImport 内提供“文档 / 收文”Tabs。
- 仅接受 `.txt/.md/.csv/.docx/.xlsx`（扩展名大小写不敏感），前端限制 10MB；后端仍保留最终校验职责。
- API client 对 FormData 原样发送，不手动设置 `Content-Type`，写请求仍携带 CSRF 与 Cookie。
- 提取文本进入可编辑 Textarea；提取中、成功、空文本和错误均有反馈。
- 本地识别后先显示 ImportPreview，不创建任务；支持逐项勾选、编辑标题、优先级和截止日期，按钮显示实际所选数量。
- 为保留用户编辑并避免调用会重新执行识别的后端导入接口，导入使用现有 `POST /api/tasks` 逐项顺序创建，而不是 `/api/ai/doc-to-tasks/import`。
- 整批导入在 TasksPage 的同一个 `runTaskWrite` 写锁内完成，与排序及其他任务写操作互斥；成功后失效 tasks、dashboard、reminders 查询。
- 批量导入中途失败时也失效相关查询，避免已创建的部分从界面消失，并保留预览错误反馈。

### 每日精选

- `/content` 路由接入 ContentPage，保留既有权限边界。
- 分区展示文章、视频、来源、要点、行动建议、日期和提示。
- 仅允许绝对 `http:` / `https:` 外链，使用 `target="_blank" rel="noreferrer"`；其他协议不渲染为链接并显示“链接不可用”。
- 完整覆盖首次加载、首次错误与重试、普通刷新中、刷新错误保留旧内容、整体空内容及单分区空内容。

## RED / GREEN 记录

### RED

先创建：

- `frontend/src/features/tasks/DocumentImport.test.tsx`
- `frontend/src/features/content/ContentPage.test.tsx`
- `frontend/src/lib/api/client.test.ts` 的 FormData 用例

首次运行：

```text
npm test -- DocumentImport.test.tsx ContentPage.test.tsx client.test.ts
Test Files  3 failed (3)
Tests  8 failed | 17 passed (25)
```

失败原因符合预期：ContentPage 模块不存在、QuickAddDrawer 尚无文档导入 Tabs、API client 将 FormData 序列化成 `{}` 并附加 JSON Content-Type。

### GREEN

实现后同一聚焦命令通过：

```text
Test Files  3 passed (3)
Tests  30 passed (30)
```

其中覆盖：

- 不支持扩展名和超过 10MB 时不发请求；
- FormData 提取及 Content-Type 行为；
- 文档/收文上下文与无能力维度展示；
- 本地预览可勾选、编辑，导入前零任务创建；
- AI 未配置禁用且零远程 AI 请求；
- 导入后查询失效与真实任务创建；
- 精选安全链接、空态、加载、错误、重试、普通刷新和 AI 换一批零请求。

## 最终验证

在 `frontend` 目录执行：

```text
npm test
Test Files  14 passed (14)
Tests  155 passed (155)

npm run lint
通过，无 ESLint 错误。

npm run build
tsc -b && vite build 通过。
```

构建仅有现存的第三方注释与大 chunk 警告（主 JS 约 763.66 kB），无构建错误。未启动或遗留任何后台服务，未 push。

## 自审与疑虑

- `git diff --check` 通过；Git 仅提示工作区 LF 将来可能按仓库配置转换为 CRLF。
- 生产代码检索未发现 `doc-to-tasks`、`daily/refresh`、API Key/Base 或模型配置；相关字符串仅存在于“请求数为零”的测试断言中。
- 有意偏离原始 brief 的 `/api/ai/doc-to-tasks/import`：该接口只接收原文并重新识别，无法忠实导入用户编辑和勾选后的 TaskDraft，且本阶段要求 AI 路径留空。因此采用现有任务创建接口，保留写锁与查询失效语义。
- 简单本地规则不是语义 AI，复杂段落需要用户在预览中校对；UI 已明确说明这一限制。
- 后续若接回远程 AI，应在用户明确提供配置后另行实现，并补充可传递编辑后草稿的导入契约；本次未改动后端以为其预留兼容性。

## Task 8 独立复核修复

### 五项问题与修复

1. **批量导入部分失败后的状态与重试**：新增 `BatchImportResult`，返回成功数、总数、首个失败索引及原因。第 N 项失败后，UI 明确显示“已成功 X、失败 1、未执行 Y”，预览移除已成功项，直接重试仅提交失败项和未执行项；部分成功与最终成功都会刷新任务相关缓存。
2. **Dashboard 快捷完成未共享写锁**：快捷完成复用同一 QueryClient 的 `getTaskWriteCoordinator`，锁覆盖 mutation 及成功、失败回调；任意任务写操作 pending 时禁用 TopThree 完成按钮，查询不受写锁影响。
3. **API client 误序列化原生 BodyInit**：FormData、Blob、ArrayBuffer（含跨 realm）、ArrayBufferView、URLSearchParams、字符串和 ReadableStream 均原样发送，且不附加 JSON Content-Type；普通 JSON 请求行为保持不变。
4. **本地日期仅检查格式**：通过 UTC 年月日回验真实日历，拒绝不存在的日期；非法日期保留在标题中，且 `dueDate=null`。
5. **文档导入可绕过脏状态确认**：DocumentImport 的文本与草稿纳入 QuickAddDrawer 的 dirty 关闭确认；文本提取或任务导入 pending 时阻止关闭并提示，提交状态通过 `useCallback` 同步并清理提示。

### 复核 RED / GREEN

先在旧实现上运行新增回归测试：

```text
npm test -- DocumentImport.test.tsx DashboardPage.test.tsx client.test.ts
Test Files  3 failed (3)
Tests  9 failed | 33 passed (42)
```

九项失败分别覆盖上述五类缺陷；跨页写锁用例另确认因完成按钮未禁用而失败。修复后运行同一命令：

```text
Test Files  3 passed (3)
Tests  42 passed (42)
```

### 最终验证与自审

在 `frontend` 目录执行：

```text
npm test
Test Files  14 passed (14)
Tests  164 passed (164)

npm run lint
通过，无 ESLint 错误。

npm run build
tsc -b && vite build 通过。
```

自审已覆盖 TasksPage 的任务 CRUD、状态切换、清空、导入、排序及 Dashboard 快捷完成，均使用共享写协调器；备份仅读取，不需要写锁。AI 仍保持未配置空态，未新增提示词、模型、API Key/Base，未调用 AI 分析或内容刷新接口。构建仅有既有第三方注释和主 JS 约 765.47 kB 的 chunk 警告，无构建错误；未启动或遗留后台服务，未 push。

## Task 8 第二轮复核修复

### Important：Tabs 切换导致 pending 状态与预览丢失

- QuickAddDrawer 外层 Tabs 改为受控模式，提取或导入 pending 时禁用两个 Trigger，并在 `onValueChange` 中再次阻止切换。
- 文档面板使用 `forceMount` 保持 DocumentImport 与 ImportPreview 挂载，普通外层 Tabs 往返保留文本、勾选状态及 Draft 编辑；非激活面板显式设置 `hidden`，避免隐藏内容意外可见、聚焦或交互。
- DocumentImport 内层文档/收文 Tabs 在 pending 时禁用并守卫切换，不再于 pending 清空 Draft；文本编辑和文件提取入口也在 pending 时禁用并守卫。
- DocumentImport 与 ImportPreview 增加卸载时的 dirty/submitting 状态清理兜底；该清理解除异常卸载后的外层锁定，但不替代 pending 防切换与防卸载。
- 回归覆盖：提取中尝试切换、完成后正常关闭；导入中尝试切换、第二项失败后保留反馈与剩余项、重试及关闭恢复；普通往返保留所有编辑且隐藏面板不可见。

### Minor：0000–0099 年日期误判

日期回验不再经过会对 0–99 年加 1900 的 `Date.UTC`，改为从 UTC 基准时间调用 `setUTCFullYear(year, month, day)`，随后继续核对年月日，正确支持 `0000`–`0099` 及其他四位年份。

### 第二轮 RED / GREEN 与最终验证

先在旧实现上运行新增回归测试：

```text
npm test -- DocumentImport.test.tsx
Test Files  1 failed (1)
Tests  4 failed | 12 passed (16)
```

四项失败分别为外层/内层 Tabs 未禁用、普通切换卸载并丢失 Draft、小年份被误判。修复后同一聚焦命令为 `1 file passed, 16 tests passed`。

最终在 `frontend` 目录执行：

```text
npm test
Test Files  14 passed (14)
Tests  168 passed (168)

npm run lint
通过，无 ESLint 错误。

npm run build
tsc -b && vite build 通过。
```

`git diff --check` 通过，改动仅涉及 QuickAddDrawer、DocumentImport、ImportPreview、日期校验、对应测试及本报告。AI 未配置空态和远程接口边界保持不变。构建仅有既有第三方注释及主 JS 约 765.72 kB 的 chunk 警告，无构建错误；未启动或遗留后台服务，未 push。
