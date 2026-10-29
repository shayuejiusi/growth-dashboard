# Qwen Task Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已验证可用的 `qwen3.8-flash` 接入现有文档导入流程，生成德育／教学／行政三分类待办，并在用户校对后写入现有任务列表。

**Architecture:** 继续使用 Spring Boot 的 OpenAI Chat Completions 兼容客户端，不新增依赖。远程文档拆解使用独立提示词与 `TaskDraft` 扩展字段；前端复用现有 Drawer、任务写入链路和批量部分失败重试机制，仅扩展 AI 分析、分组预览与分类编辑。API Key 只从 `AI_API_KEY` 环境变量读取。

**Tech Stack:** Java 17、Spring Boot 3.5、Jackson、JUnit 5、React 19、TypeScript、Tailwind CSS、Vitest、Testing Library、Playwright。

## Global Constraints

- 模型固定配置为 `qwen3.8-flash`，兼容地址为 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
- 不新增 AI SDK 或前端组件依赖，不把密钥写入源码、前端、测试快照或 Git。
- 优先级继续使用现有 `P0／P1／P2`，AI 分类只允许 `德育／教学／行政`。
- 远程 AI 失败必须明确显示错误，不能将本地规则结果标记为 AI 结果。
- 预览阶段不得创建任务；保留现有部分成功、失败重试、关闭确认和日期选择行为。
- 能力成长与能力评估入口继续保持隐藏，本次不修改相关接口。
- 不执行 Git commit，除非用户另行明确要求。

---

### Task 1: 后端任务草稿契约与真实模型拆解

**Files:**
- Modify: `src/main/java/com/personal/dashboard/ai/AiService.java`
- Modify: `src/main/java/com/personal/dashboard/ai/OpenAiCompatibleAiService.java`
- Modify: `src/main/java/com/personal/dashboard/ai/AiGateway.java`
- Modify: `src/main/java/com/personal/dashboard/ai/LocalHeuristicAiService.java`
- Create: `src/test/java/com/personal/dashboard/ai/OpenAiCompatibleAiServiceTest.java`
- Create: `src/test/java/com/personal/dashboard/ai/AiGatewayTest.java`

**Interfaces:**
- Consumes: 现有 `POST {AI_BASE_URL}/chat/completions`、`AiService.extractTasks(String, String)`。
- Produces: `TaskDraft(title, priority, dueDate, needReport, capabilities, category, sourceText, confidence, needsReview, reviewReason)`；保留五参数构造供本地规则使用。

- [ ] **Step 1: 写远程响应解析与校验的失败测试**

使用 JDK `HttpServer` 返回固定 Chat Completions 响应，验证 `{"tasks":[...]}` 能解析为三分类草稿，并验证错误分类、非法日期、空标题、超长标题会抛出 `AiCallException`。另建 `AiGatewayTest`，用 Mockito 验证 `mode="ai"` 时远程异常直接向上抛出，`mode="local"` 不访问远程服务。

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn -Dtest=OpenAiCompatibleAiServiceTest,AiGatewayTest test`
Expected: 因新字段、新响应结构或严格远程路由尚未实现而编译失败或断言失败。

- [ ] **Step 3: 扩展草稿并实现最小后端逻辑**

`TaskDraft` 在原有五字段后追加：

```java
String category, String sourceText, Double confidence,
boolean needsReview, String reviewReason
```

保留原五参数构造函数，本地草稿的分类与溯源字段为 `null`，`needsReview=false`。远程文档拆解提示词使用已确认的学校待办规则，动态传入 `LocalDate.now(ZoneId.of("Asia/Shanghai"))`，要求只返回 `{"tasks":[]}`。解析后校验标题非空且不超过 255 字、优先级枚举、ISO 日期、三分类枚举和原文依据。

`AiGateway.extractTasks(text, kind, mode)` 的行为固定为：

```java
if ("local".equalsIgnoreCase(mode)) return local.extractTasks(text, kind);
if (remote.isConfigured()) return remote.extractTasks(text, kind);
throw new OpenAiCompatibleAiService.AiCallException("AI 尚未配置，请配置服务端 API Key 或使用本地快速识别");
```

远程未配置或调用失败时都明确返回错误；离线能力仅由用户显式选择本地模式。

- [ ] **Step 4: 运行后端定向测试**

Run: `mvn -Dtest=OpenAiCompatibleAiServiceTest,AiGatewayTest test`
Expected: 所有定向测试通过。

### Task 2: 前端 AI 请求与三分类分组预览

**Files:**
- Modify: `frontend/src/features/tasks/ai-api.ts`
- Modify: `frontend/src/features/tasks/DocumentImport.tsx`
- Modify: `frontend/src/features/tasks/ImportPreview.tsx`
- Modify: `frontend/src/features/tasks/TasksPage.tsx`
- Modify: `frontend/src/features/tasks/DocumentImport.test.tsx`

**Interfaces:**
- Consumes: `POST /api/ai/doc-to-tasks`，请求 `{text, kind, mode:"ai"}`，响应 `TaskDraft[]`。
- Produces: `analyzeDocumentTasks(text, kind, signal?)`；可编辑的 `category` 与完整草稿导入字段。

- [ ] **Step 1: 将暂未配置空态测试替换为真实 AI 交互测试**

新增测试覆盖：点击“AI 智能分析”发送远程请求；分析中按钮和 Drawer 防关闭生效；响应按德育／教学／行政分组；可修改分类；复核原因与原文依据可见；空结果显示提示；HTTP 500 显示 Alert 且不生成预览；导入时保留分类和原文依据。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- DocumentImport.test.tsx`
Expected: 因 AI 按钮仍禁用、分组与分类字段尚未实现而失败。

- [ ] **Step 3: 实现 AI 请求与预览**

在 `ai-api.ts` 扩展 `TaskDraft`：

```ts
category: "德育" | "教学" | "行政" | null
sourceText?: string | null
confidence?: number | null
needsReview?: boolean
reviewReason?: string | null
```

新增 `analyzeDocumentTasks`，通过现有 `api` 客户端发送请求，保留 CSRF 和统一错误解析。`DocumentImport` 增加独立 `analyzing` 状态、加载反馈、空结果与错误状态，本地快速识别保持不变。

`ImportPreview` 按 `德育／教学／行政／未分类` 分组，仅显示非空组；增加分类下拉框、需上报勾选、复核提示和可展开的原文依据。导入映射保留所有草稿字段。`TasksPage` 创建任务时写入 `draft.category`，来源按是否有 AI 溯源信息区分为 `AI 文档导入` 或 `文档导入（本地简单规则）`，`sourceText` 写入备注的“原文依据”部分。

- [ ] **Step 4: 运行前端定向测试与构建**

Run: `npm test -- DocumentImport.test.tsx && npm run build`
Expected: 测试通过，TypeScript 与 Vite 构建成功。

### Task 3: 真实千问完整流程与全量回归

**Files:**
- Modify: `frontend/playwright.config.ts`（仅从进程环境读取 AI 配置，不保存密钥）
- Create: `frontend/e2e/ai-document-import.spec.ts`

**Interfaces:**
- Consumes: 真实 `AI_API_KEY`、已构建后端 JAR、Vite 开发服务器和默认管理员登录。
- Produces: 文档输入 → 千问拆解 → 三分类预览 → 用户确认 → 任务列表可检索的端到端证据。

- [ ] **Step 1: 编写真实流程 Playwright 测试**

测试仅在 `RUN_REAL_AI_E2E=1` 且存在 `AI_API_KEY` 时执行。输入包含一条德育和一条教学事项的短通知，等待 AI 预览，校对分类，点击导入并验证任务出现在列表。测试结束清理新建任务，不触碰其他数据。Playwright 后端环境从 `process.env` 传递 `AI_BASE_URL／AI_API_KEY／AI_MODEL`，默认普通 E2E 仍使用空密钥。

- [ ] **Step 2: 运行后端与前端全量测试**

Run: `mvn test`
Run: `npm test && npm run lint && npm run build`
Expected: 全部通过，无新增 ESLint 或 TypeScript 错误。

- [ ] **Step 3: 构建并运行真实 AI 端到端测试**

Run: `mvn -DskipTests package`
Run: `RUN_REAL_AI_E2E=1 AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 AI_MODEL=qwen3.8-flash AI_API_KEY=<process-secret> npm run test:e2e -- ai-document-import.spec.ts`
Expected: 真实 API 返回三分类草稿，预览确认后任务创建成功；测试输出与日志不包含密钥。

- [ ] **Step 4: 最终检查**

Run: `git status --short` 与 `git diff --check`
Expected: 仅出现本计划列出的源码、测试与计划文件；无密钥文件、构建产物或空白错误。所有临时服务在交付前停止。
