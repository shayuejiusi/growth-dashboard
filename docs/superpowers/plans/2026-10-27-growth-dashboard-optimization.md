# Growth Dashboard Full Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将个人工作与能力提升看板迁移为独立 React 前端和 Spring Boot API，完成全站体验升级，并新增任务排序、全局搜索和深色模式。

**Architecture:** 保留现有 Java 业务与数据库，后端改造为携带 HttpOnly Cookie 会话和 CSRF 防护的独立 REST API；前端采用功能模块化的 React SPA。前后端通过 `/api` 交互，开发环境走 Vite 代理，生产环境独立部署并通过显式 CORS 配置连接。

**Tech Stack:** Java 17、Spring Boot 3.5、Spring Data JPA、React 19、TypeScript 5.9、Vite 7、Tailwind CSS 3、shadcn/ui、Radix UI、TanStack Query、Zustand、React Router、dnd-kit、Motion、Lucide React、Vitest、Testing Library、Playwright、JUnit 5、MockMvc。

## Global Constraints

- 工作根目录固定为 `D:\kimi\Workspaces\待办优化\growth-dashboard`，不修改 `D:\kimi\Workspaces\看板生成\growth-dashboard` 原项目。
- `growth-dashboard` 是唯一交付根目录：前端、后端、测试、组件源码、部署配置、启动脚本和文档全部放在其中；最终代码不得通过相对路径、绝对路径或构建脚本引用其他工作区文件。
- 外部组件只在实施时作为复制来源，复制完成后源码归项目所有；Java、Maven、Node 和 npm 依赖通过标准工具安装，不将工具二进制或其他项目 node_modules 打入交付目录。
- 当前没有 Git 仓库，不执行 `git init`、`git add` 或 `git commit`；每个 Task 以测试通过和构建产物作为检查点。
- 后端 Java 使用 `C:\Users\22580\.jdks\ms-17.0.18`，Maven 使用 `D:\kimi\Workspaces\看板生成\tools-maven\bin\mvn`。
- 能力成长地图、能力评估、驾驶舱能力摘要及其入口不进入前端；现有 CapabilityController、AssessmentController 及其数据不得删除。
- 全站采用专业侧边导航、暖白与墨绿主题；桌面固定侧栏、平板可折叠、手机 Drawer 导航。
- 深浅主题都使用语义 Token；不直接在各页面硬编码另一套主题色。
- Tooltip 只放辅助信息；Toast 反馈操作结果；Alert 展示系统重要提醒；Popconfirm 处理轻量确认；Modal 处理短内容和高危操作；Drawer 处理长表单与对照编辑。
- 表单 Modal/Drawer 禁止点击蒙层关闭；未保存关闭需要提示；可撤销操作不二次确认；按钮文案描述具体动作。
- 服务端状态只由 TanStack Query 管理；Zustand 仅保存主题、侧栏和搜索面板等 UI 状态。
- 全局搜索仅覆盖任务、人员和每日内容，输入 trim 后至少 1 字、最多 50 字、防抖 300ms；能力评估内容不进入结果。
- 不在前端保存密码、AI Key 或长期令牌；认证使用 HttpOnly Cookie，写操作校验 CSRF。
- 不新增任务导出功能；保留现有 JSON 备份。
- 不安装 Recharts：唯一图表能力雷达已明确隐藏，剩余统计和九宫格无需新增图表依赖。
- 最终不得遗留后台 npm、Node、Vite 或 Java 测试进程。

---

## File Structure

```text
growth-dashboard/
├─ frontend/                         # 独立 React 应用
│  ├─ src/app/                       # Provider、路由、应用外壳、权限
│  ├─ src/components/ui/             # 复用并按需调整的 shadcn/ui
│  ├─ src/components/feedback/       # StatePanel、ConfirmDialog、Popconfirm
│  ├─ src/features/auth/             # 登录和会话
│  ├─ src/features/dashboard/        # 驾驶舱
│  ├─ src/features/tasks/            # 任务、排序、快速新增
│  ├─ src/features/reminders/        # 提醒中心
│  ├─ src/features/content/          # 每日精选
│  ├─ src/features/admin/            # 账号管理
│  ├─ src/features/review/           # 日复盘
│  ├─ src/features/talent/           # 人才和花名册
│  ├─ src/features/search/           # 全局搜索
│  ├─ src/lib/api/                   # fetch、错误、CSRF、类型
│  ├─ src/stores/                    # UI Zustand store
│  └─ e2e/                           # Playwright 核心流程
├─ src/main/java/com/personal/dashboard/
│  ├─ api/                           # REST 控制器和统一错误
│  ├─ auth/                          # Cookie 会话、CSRF、权限、CORS
│  ├─ model/                         # API 模型
│  └─ service/                       # 排序与搜索逻辑
├─ src/test/java/                    # 后端集成测试
├─ deploy/                           # 分离部署 Nginx 示例
└─ docs/                             # 设计与运行说明
```

后端命令统一先执行：

```bash
export JAVA_HOME='C:\Users\22580\.jdks\ms-17.0.18'
export PATH="$JAVA_HOME/bin:$PATH"
MVN='/d/kimi/Workspaces/看板生成/tools-maven/bin/mvn'
```

---

### Task 1: Cookie 会话、CSRF、CORS 与统一 API 错误

**Files:**
- Modify: `pom.xml`
- Modify: `src/main/java/com/personal/dashboard/auth/AuthService.java`
- Modify: `src/main/java/com/personal/dashboard/auth/AuthInterceptor.java`
- Modify: `src/main/java/com/personal/dashboard/auth/WebConfig.java`
- Modify: `src/main/java/com/personal/dashboard/api/AuthController.java`
- Create: `src/main/java/com/personal/dashboard/auth/SessionCookies.java`
- Create: `src/main/java/com/personal/dashboard/api/ApiError.java`
- Create: `src/main/java/com/personal/dashboard/api/ApiExceptionHandler.java`
- Test: `src/test/java/com/personal/dashboard/auth/AuthApiIntegrationTest.java`

**Interfaces:**
- Produces: Cookie `DASHBOARD_SESSION`；GET `/api/auth/csrf` → `{ "csrfToken": string }`；写操作请求头 `X-CSRF-TOKEN`。
- Produces: `ApiError(timestamp, status, code, message, path, requestId)`。
- Consumes: 保留 AuthService 12 小时内存会话和现有用户密码校验，不引入 JWT。

- [ ] **Step 1: 加入后端测试依赖并写失败测试**

在 `pom.xml` 的 dependencies 中加入：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-test</artifactId>
  <scope>test</scope>
</dependency>
```

创建 `@SpringBootTest` + `@AutoConfigureMockMvc` 测试，使用 seed 中管理员账号验证登录、CSRF 和跨域：

```java
@Test
void loginSetsHttpOnlyCookieAndCsrfProtectsWrites() throws Exception {
  MvcResult login = mvc.perform(post("/api/auth/login")
      .contentType(APPLICATION_JSON)
      .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
    .andExpect(status().isOk())
    .andExpect(cookie().httpOnly("DASHBOARD_SESSION", true))
    .andExpect(jsonPath("$.token").doesNotExist())
    .andReturn();

  Cookie session = login.getResponse().getCookie("DASHBOARD_SESSION");
  String csrf = mvc.perform(get("/api/auth/csrf").cookie(session))
    .andExpect(status().isOk()).andReturn()
    .getResponse().getContentAsString();
  String token = objectMapper.readTree(csrf).get("csrfToken").asText();

  mvc.perform(post("/api/auth/logout").cookie(session))
    .andExpect(status().isForbidden());
  mvc.perform(post("/api/auth/logout").cookie(session).header("X-CSRF-TOKEN", token))
    .andExpect(status().isOk());
}

@Test
void corsOnlyAllowsConfiguredFrontend() throws Exception {
  mvc.perform(options("/api/auth/login")
      .header(HttpHeaders.ORIGIN, "http://localhost:5173")
      .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
      "http://localhost:5173"));
}
```

- [ ] **Step 2: 运行测试确认当前认证不满足新契约**

Run: `"$MVN" -Dtest=AuthApiIntegrationTest test`
Expected: FAIL，当前响应仍包含 `token`，且没有 `DASHBOARD_SESSION`。

- [ ] **Step 3: 实现会话 Cookie 和 CSRF**

在 AuthService 中让 Session 保存 CSRF：

```java
public record AuthSession(String token, String csrfToken, User user) {}
private record Session(String username, long expiresAt, String csrfToken) {}

public AuthSession login(String username, String password) {
  return repo.findById(username)
    .filter(u -> hash(u.getSalt(), password).equals(u.getPasswordHash()))
    .map(u -> {
      String token = randomToken();
      String csrf = randomToken();
      tokens.put(token, new Session(username,
        System.currentTimeMillis() + SESSION_MILLIS, csrf));
      return new AuthSession(token, csrf, u.toRecord());
    }).orElse(null);
}
public User resolve(String token) {
  if (token == null || token.isBlank()) return null;
  Session s = tokens.get(token);
  if (s == null || s.expiresAt() < System.currentTimeMillis()) {
    tokens.remove(token);
    return null;
  }
  return repo.findById(s.username()).map(UserEntity::toRecord).orElse(null);
}
private static String randomToken() {
  return UUID.randomUUID().toString().replace("-", "")
      + UUID.randomUUID().toString().replace("-", "");
}
public boolean validCsrf(String token, String csrf) {
  Session s = tokens.get(token);
  return s != null && s.expiresAt() >= System.currentTimeMillis()
      && csrf != null && MessageDigest.isEqual(
        s.csrfToken().getBytes(StandardCharsets.UTF_8),
        csrf.getBytes(StandardCharsets.UTF_8));
}
```

`SessionCookies` 集中定义 Cookie，避免控制器各自拼装：

```java
public static ResponseCookie session(String token, Duration maxAge, boolean secure) {
  return ResponseCookie.from("DASHBOARD_SESSION", token)
    .httpOnly(true).secure(secure).sameSite("Lax").path("/")
    .maxAge(maxAge).build();
}
```

登录响应只返回 `username/name/level`，通过 `Set-Cookie` 写会话；`/api/auth/csrf` 对 GET 放行并返回当前会话 CSRF；`/api/auth/logout` 清除 Cookie。AuthInterceptor 从 Cookie 读取会话，保留 Bearer 读取仅用于现有 API 自动化兼容，但新前端不得使用 Bearer。对 POST/PUT/PATCH/DELETE 校验 `X-CSRF-TOKEN`。

WebConfig 使用属性 `app.frontend-origins` 和 `app.cookie.secure`：

```java
registry.addMapping("/api/**")
  .allowedOrigins(frontendOrigins.split(","))
  .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
  .allowedHeaders("Content-Type", "X-CSRF-TOKEN")
  .allowCredentials(true).maxAge(3600);
```

在 `application.properties` 增加：

```properties
app.frontend-origins=${FRONTEND_ORIGINS:http://localhost:5173}
app.cookie.secure=${COOKIE_SECURE:false}
```

- [ ] **Step 4: 实现统一错误结构并验证**

创建 record：

```java
public record ApiError(String timestamp, int status, String code, String message,
                       String path, String requestId) {}
```

`@RestControllerAdvice` 分别处理 400 参数错误、401 会话失效、403 权限/CSRF、404 资源和 500 未预期错误；500 不返回堆栈，requestId 使用 `UUID.randomUUID().toString()`。AuthInterceptor 的拒绝响应也复用同一结构。

Run: `"$MVN" -Dtest=AuthApiIntegrationTest test`
Expected: PASS，登录不再向 body 泄露会话 token，写操作无 CSRF 返回 403。

- [ ] **Step 5: 检查点**

Run: `"$MVN" test`
Expected: 后端全部测试 PASS；旧能力接口未被删除。

---

### Task 2: 持久化任务排序与并发保护

**Files:**
- Modify: `src/main/java/com/personal/dashboard/model/TaskItem.java`
- Modify: `src/main/java/com/personal/dashboard/entity/TaskEntity.java`
- Modify: `src/main/java/com/personal/dashboard/repo/TaskRepository.java`
- Modify: `src/main/java/com/personal/dashboard/service/StatsService.java`
- Modify: `src/main/java/com/personal/dashboard/api/TaskApiController.java`
- Create: `src/main/java/com/personal/dashboard/service/TaskOrderService.java`
- Test: `src/test/java/com/personal/dashboard/api/TaskOrderIntegrationTest.java`

**Interfaces:**
- Produces: PUT `/api/tasks/order`，body `{ "tasks": [{ "id": string, "version": number }] }`。
- Produces: TaskItem 新增 `position: int` 和 `version: long`，旧构造签名保留为重载。
- Rule: 请求必须恰好包含当前用户全部任务各一次，响应为更新后的完整任务列表。

- [ ] **Step 1: 写排序隔离和并发失败测试**

```java
@Test
void reorderPersistsForOwnerAndRejectsStaleVersion() throws Exception {
  List<TaskItem> mine = listTasks("admin");
  List<TaskItem> reversed = new ArrayList<>(mine);
  Collections.reverse(reversed);

  mvc.perform(put("/api/tasks/order").cookie(adminSession)
      .header("X-CSRF-TOKEN", adminCsrf)
      .contentType(APPLICATION_JSON).content(orderJson(reversed)))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$[0].id").value(reversed.get(0).id()))
    .andExpect(jsonPath("$[0].position").value(0));

  mvc.perform(put("/api/tasks/order").cookie(adminSession)
      .header("X-CSRF-TOKEN", adminCsrf)
      .contentType(APPLICATION_JSON).content(orderJson(reversed)))
    .andExpect(status().isConflict())
    .andExpect(jsonPath("$.code").value("TASK_ORDER_CONFLICT"));

  mvc.perform(get("/api/tasks").cookie(staffSession))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$[*].id", not(hasItem(mine.get(0).id()))));
}
```

- [ ] **Step 2: 运行测试确认接口尚不存在**

Run: `"$MVN" -Dtest=TaskOrderIntegrationTest test`
Expected: FAIL，PUT `/api/tasks/order` 未映射。

- [ ] **Step 3: 添加 position/version 并保持旧数据兼容**

TaskItem 在 record 尾部增加 `Integer position, Long version`，添加与旧 16 参数签名相同的构造器并委托默认值 `null, null`；新增 `withOrder(int, long)`。TaskEntity 增加：

```java
@Column(nullable = false)
private int position = 0;
@Version
@Column(nullable = false)
private long version = 0;
```

`from()` 写入 position/version，`toRecord()` 读出，并补充 `getVersion()`、`setPosition(int)`；创建任务时将 position 设置为当前用户任务数量。TaskRepository 用 `findByOwnerOrderByPositionAscCreatedAtAsc` 替代无排序查询；StatsService 改用该方法，历史相同 position 由 createdAt 保证稳定次序。

- [ ] **Step 4: 实现事务性排序服务**

```java
public record OrderItem(String id, long version) {}

@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select t from TaskEntity t where t.owner = :owner")
List<TaskEntity> findByOwnerForUpdate(@Param("owner") String owner);

@Transactional
public List<TaskItem> reorder(String owner, List<OrderItem> requested) {
  List<TaskEntity> current = repo.findByOwnerForUpdate(owner);
  validateExactIdsAndVersions(current, requested);
  Map<String, Integer> positions = IntStream.range(0, requested.size()).boxed()
    .collect(toMap(i -> requested.get(i).id(), i -> i));
  current.forEach(e -> e.setPosition(positions.get(e.getId())));
  return repo.saveAll(current).stream()
    .sorted(Comparator.comparingInt(e -> positions.get(e.getId())))
    .map(TaskEntity::toRecord).toList();
}

private static void validateExactIdsAndVersions(
    List<TaskEntity> current, List<OrderItem> requested) {
  Map<String, TaskEntity> byId = current.stream()
    .collect(toMap(TaskEntity::getId, Function.identity()));
  Set<String> unique = new HashSet<>();
  if (current.size() != requested.size()) {
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "排序必须包含全部任务");
  }
  for (OrderItem item : requested) {
    TaskEntity entity = byId.get(item.id());
    if (entity == null || !unique.add(item.id())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "任务 ID 缺失、重复或无权访问");
    }
    if (entity.getVersion() != item.version()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "任务已被其他操作更新");
    }
  }
}
```

控制器只接收当前登录用户名，不接受 owner 参数；409 经 ApiExceptionHandler 转为 `TASK_ORDER_CONFLICT`。

Run: `"$MVN" -Dtest=TaskOrderIntegrationTest test`
Expected: PASS；旧 version 冲突返回 409，用户数据保持隔离。

- [ ] **Step 5: 回归任务统计和原任务 API**

Run: `"$MVN" test`
Expected: PASS；创建任务默认排在末尾，完成/重开/重复任务规则不变。

---

### Task 3: 权限感知的全局搜索 API

**Files:**
- Create: `src/main/java/com/personal/dashboard/model/SearchResult.java`
- Create: `src/main/java/com/personal/dashboard/service/SearchService.java`
- Create: `src/main/java/com/personal/dashboard/api/SearchController.java`
- Modify: `src/main/java/com/personal/dashboard/auth/AuthInterceptor.java`
- Test: `src/test/java/com/personal/dashboard/api/SearchIntegrationTest.java`

**Interfaces:**
- Produces: GET `/api/search?q=关键词` → `SearchResponse(List<SearchResult> tasks, people, content)`。
- Produces: `SearchResult(String type, String id, String title, String subtitle, String path)`。
- Rule: level 1 搜索任务、人才、内容；level 2 搜索任务、内容；level 3 只搜索自己的任务；每组最多 5 条。

- [ ] **Step 1: 写搜索内容、空结果和权限测试**

```java
@Test
void searchHonorsRoleAndNeverReturnsCapabilities() throws Exception {
  mvc.perform(get("/api/search").param("q", "德育").cookie(staffSession))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.people").isEmpty())
    .andExpect(jsonPath("$.content").isEmpty())
    .andExpect(jsonPath("$.tasks[*].type", everyItem(is("task"))));

  mvc.perform(get("/api/search").param("q", "领导力").cookie(adminSession))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.tasks[*].path", everyItem(not(containsString("assessment")))));
}

@Test void blankAndLongQueriesAreRejected() throws Exception {
  mvc.perform(get("/api/search").param("q", " ").cookie(adminSession))
    .andExpect(status().isBadRequest());
  mvc.perform(get("/api/search").param("q", "x".repeat(51)).cookie(adminSession))
    .andExpect(status().isBadRequest());
}
```

- [ ] **Step 2: 运行并确认 404**

Run: `"$MVN" -Dtest=SearchIntegrationTest test`
Expected: FAIL，搜索接口不存在。

- [ ] **Step 3: 实现搜索服务**

使用 StatsService 获取当前用户任务；level 1 通过 JsonDocService 读取 `talent`，level 1/2 读取 `content`。关键词统一 `trim().toLowerCase(Locale.ROOT)`，对标题、姓名、来源、文章标题做 `contains` 匹配，不扫描 capability、assessment 或密码字段。

```java
public record SearchResponse(List<SearchResult> tasks,
                             List<SearchResult> people,
                             List<SearchResult> content) {}

private static <T> List<T> limit(Stream<T> stream) {
  return stream.limit(5).toList();
}
```

结果 path 固定由服务端生成：任务 `/tasks?focus={id}`、人员 `/talent?person={id}`、内容 `/content?item={urlEncodedTitle}`。控制器只接收 `q` 和 currentUser；`q.trim()` 长度小于 1 或大于 50 时抛出 400。

AuthInterceptor 的 level 3 允许路径增加 `/api/search`，并在搜索服务内部继续按角色过滤分类：

```java
case 3 -> path.startsWith("/api/dashboard") || path.startsWith("/api/tasks")
    || path.startsWith("/api/reminders") || path.startsWith("/api/auth/")
    || path.startsWith("/api/ai/") || path.startsWith("/api/search");
```

```java
boolean includePeople = user.level() == 1;
boolean includeContent = user.level() <= 2;
return new SearchResponse(
  limit(searchTasks(user.username(), normalized)),
  includePeople ? limit(searchPeople(normalized)) : List.of(),
  includeContent ? limit(searchContent(normalized)) : List.of());
```

- [ ] **Step 4: 验证搜索与全量回归**

Run: `"$MVN" -Dtest=SearchIntegrationTest test && "$MVN" test`
Expected: PASS；无结果返回三个空数组而非 404，越权分类始终为空。

---

### Task 4: React 工程、设计 Token、基础组件与测试环境

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`
- Create: `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/index.css`
- Create: `frontend/src/lib/utils.ts`, `frontend/src/test/setup.ts`
- Copy then modify only as needed: `frontend/src/components/ui/*`
- Create: `frontend/src/components/ui/button.test.tsx`

**Interfaces:**
- Produces: `npm run dev -- --host 0.0.0.0 --port 5173`、build、test、lint。
- Produces: `cn(...inputs: ClassValue[])` 和语义 Tailwind 颜色 Token。
- Reuses: `D:\kimi\Workspaces\看板生成\growth-supermarket\src\components\ui` 中源码可控的现有组件，不复制 node_modules。

- [ ] **Step 1: 建立 Vite 工程并安装明确需要的依赖**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router @tanstack/react-query zustand \
  @radix-ui/react-alert-dialog @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label \
  @radix-ui/react-popover @radix-ui/react-select @radix-ui/react-slot \
  @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-separator \
  class-variance-authority clsx tailwind-merge lucide-react motion \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-hook-form zod @hookform/resolvers sonner vaul
npm install -D tailwindcss@3.4.19 postcss autoprefixer @types/node \
  vitest jsdom @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom @playwright/test eslint-plugin-react-hooks
npx tailwindcss init -p
```

只复制所需的 alert-dialog、button、card、input、label、textarea、badge、select、tabs、dialog、drawer、dropdown-menu、popover、tooltip、skeleton、alert、table、scroll-area、separator、sonner 组件和 `lib/utils.ts`。先复制到当前工作区 `frontend/reference-ui`，检查后再移动到目标目录，完成后删除 reference-ui；不复制无用组件和 inspect 插件。sonner 包装组件若引用 next-themes，则改为由 Task 5 的 Zustand theme 传入，不新增第二套主题状态。

- [ ] **Step 2: 配置脚本、代理与 Vitest**

`package.json` scripts：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Vite 使用 `/api` 代理，且不在配置中写死 API 密钥：

```ts
server: {
  proxy: {
    "/api": process.env.VITE_API_PROXY_TARGET ?? "http://localhost:7100",
  },
},
test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", globals: true }
```

- [ ] **Step 3: 写主题和 Button 失败测试**

```tsx
it("exposes a visible focus ring and disabled state", async () => {
  render(<><Button>新建任务</Button><Button disabled>保存任务</Button></>);
  const create = screen.getByRole("button", { name: "新建任务" });
  create.focus();
  expect(create).toHaveFocus();
  expect(screen.getByRole("button", { name: "保存任务" })).toBeDisabled();
});
```

Run: `npm test -- button.test.tsx`
Expected: 初始 FAIL（组件尚未复制/配置完成）。

- [ ] **Step 4: 写入暖白墨绿 Token 并复用组件**

`src/index.css` 核心变量：

```css
:root {
  --background: 60 20% 97%; --foreground: 150 12% 16%;
  --card: 0 0% 100%; --card-foreground: 150 12% 16%;
  --primary: 158 37% 29%; --primary-foreground: 0 0% 100%;
  --secondary: 90 18% 92%; --secondary-foreground: 150 18% 24%;
  --muted: 90 14% 94%; --muted-foreground: 140 7% 42%;
  --accent: 100 18% 91%; --accent-foreground: 150 20% 24%;
  --destructive: 0 66% 47%; --border: 90 12% 85%; --input: 90 12% 85%;
  --ring: 158 37% 29%; --radius: .75rem;
}
.dark {
  --background: 150 10% 10%; --foreground: 80 14% 91%;
  --card: 150 9% 13%; --card-foreground: 80 14% 91%;
  --primary: 151 30% 60%; --primary-foreground: 150 15% 10%;
  --secondary: 150 8% 18%; --secondary-foreground: 80 14% 91%;
  --muted: 150 8% 17%; --muted-foreground: 100 7% 65%;
  --accent: 150 8% 20%; --accent-foreground: 80 14% 91%;
  --destructive: 0 58% 55%; --border: 150 7% 24%; --input: 150 7% 24%;
  --ring: 151 30% 60%;
}
```

Tailwind 配置 `darkMode: ["class"]`，将这些变量映射到 background/card/primary 等语义色。所有弹层 z-index、focus ring 和 disabled 样式沿用 shadcn 组件。

- [ ] **Step 5: 验证基础工程**

Run: `npm test -- button.test.tsx && npm run build && npm run lint`
Expected: 全部 PASS；`dist/index.html` 存在；无未使用依赖或 inspect 插件。

---

### Task 5: API Client、认证、路由、应用外壳与主题

**Files:**
- Create: `frontend/src/lib/api/types.ts`, `client.ts`, `errors.ts`
- Create: `frontend/src/features/auth/auth-api.ts`, `use-session.ts`, `LoginPage.tsx`
- Create: `frontend/src/app/App.tsx`, `providers.tsx`, `AppShell.tsx`, `RequireRole.tsx`
- Create: `frontend/src/stores/ui-store.ts`
- Create: `frontend/src/components/feedback/StatePanel.tsx`, `ConfirmDialog.tsx`, `Popconfirm.tsx`
- Test: `frontend/src/lib/api/client.test.ts`, `frontend/src/app/AppShell.test.tsx`

**Interfaces:**
- Produces: `api<T>(path, { method, body, signal })`、 `useSession()`、`RequireRole(maxLevel)`。
- Produces: routes `/dashboard`, `/tasks`, `/reminders`, `/content`, `/admin/users`, `/review`, `/talent`。
- Rule: level 1 全可用；level 2 无 admin/review/talent；level 3 仅 dashboard/tasks/reminders。

- [ ] **Step 1: 写 401、CSRF 和权限导航失败测试**

Mock fetch，验证 client 自动携带 credentials 和 CSRF：

```ts
it("adds csrf to writes and emits unauthorized once", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-1" }));
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: "t1" }, 201));
  await api("/api/tasks", { method: "POST", body: { title: "任务" } });
  expect(fetch).toHaveBeenLastCalledWith("/api/tasks", expect.objectContaining({
    credentials: "include",
    headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-1" }),
  }));
});
```

AppShell 测试 level 3 不出现每日精选、账号、复盘和人才，也不出现任何“能力”导航。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- client.test.ts AppShell.test.tsx`
Expected: FAIL，相关模块尚未创建。

- [ ] **Step 3: 实现 API 与会话边界**

```ts
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-TOKEN"] = await csrfToken();
  const response = await fetch(path, {
    method, headers, credentials: "include", signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 401) window.dispatchEvent(new Event("auth:unauthorized"));
  if (!response.ok) throw await toApiError(response);
  return response.status === 204 ? undefined as T : response.json();
}
```

会话使用 TanStack Query `/api/auth/me`；401 清空 session 查询并返回登录页，登录成功恢复原 location。401 事件去重，避免多个请求同时造成多次跳转。

- [ ] **Step 4: 实现外壳、主题与反馈组件**

Zustand persist 只存 `{ theme: "light" | "dark", sidebarCollapsed: boolean }`；theme 变化切换 `document.documentElement.classList`。侧栏包含权限过滤后的 7 个业务入口；顶部包含搜索按钮、主题按钮、新建任务和用户菜单。

ConfirmDialog 使用 AlertDialog，取消/动作按钮写具体文案；Popconfirm 使用 Popover；StatePanel 统一 `loading/error/empty` 三态。表单 Drawer 设置 `onPointerDownOutside={(e) => e.preventDefault()}`，关闭时检查 dirty，未保存用 ConfirmDialog 提示“放弃未保存修改”。

- [ ] **Step 5: 验证路由和主题**

Run: `npm test -- client.test.ts AppShell.test.tsx && npm run build`
Expected: PASS；三个角色只看到各自入口；路由中无 capability/assessment。

---

### Task 6: 驾驶舱与提醒中心迁移

**Files:**
- Create: `frontend/src/features/dashboard/types.ts`, `dashboard-api.ts`, `DashboardPage.tsx`
- Create: `frontend/src/features/dashboard/StatCards.tsx`, `TopThree.tsx`
- Create: `frontend/src/features/reminders/types.ts`, `reminders-api.ts`, `RemindersPage.tsx`
- Test: `frontend/src/features/dashboard/DashboardPage.test.tsx`, `frontend/src/features/reminders/RemindersPage.test.tsx`

**Interfaces:**
- Consumes: GET `/api/dashboard`、GET `/api/reminders`、Task 5 的 `api` 和 StatePanel。
- Produces: `dashboardKeys = { all: ["dashboard"], detail: () => [...] }` 供任务变更后失效刷新。
- Explicit exclusion: 不渲染 cockpitAssessment、radar、AI 重新评估或任何能力入口。

- [ ] **Step 1: 写数据、空状态和排除能力入口测试**

```tsx
it("renders task cockpit without capability assessment", async () => {
  mockApi("/api/dashboard", { generatedAt: "2026-10-27 10:00", stats: {
    total: 1, open: 1, overdue: 0, highPriority: 1, todayDue: 1,
    completedTotal: 0, completionRate: 0, needReport: 0,
  }, top3: [task], focusNow: "先完成讲话稿" });
  renderWithProviders(<DashboardPage />);
  expect(await screen.findByText("今日最重要的 3 件事")).toBeVisible();
  expect(screen.queryByText(/能力评估|能力成长|重新评估/)).not.toBeInTheDocument();
});
```

提醒测试覆盖 `todayDue/overdue/highPriority/needReport/recurring` 五组、空组不误导、复制话术成功 Toast。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- DashboardPage.test.tsx RemindersPage.test.tsx`
Expected: FAIL，页面模块不存在。

- [ ] **Step 3: 实现驾驶舱**

DashboardPage 用 `useQuery` 拉取数据；StatCards 显示今日待办、逾期、高优先级、完成率；TopThree 显示优先级、截止时间和完成快捷操作；focusNow 用非打断提示区。AI 状态在顶部用文本 Badge 展示，失败时 Alert 提供重试，不阻断任务数据。

- [ ] **Step 4: 实现提醒中心**

五组提醒使用 Tabs/折叠分区，每项可跳转 `/tasks?focus=id`；话术卡片复制使用 `navigator.clipboard.writeText`，失败显示可手动选择的文本，不伪造成功反馈。所有列表首次加载骨架屏、错误重试、空状态下一步均使用 StatePanel。

- [ ] **Step 5: 验证页面与类型**

Run: `npm test -- DashboardPage.test.tsx RemindersPage.test.tsx && npm run build`
Expected: PASS；能力评估文本和入口为零，任务数据正常展示。

---

### Task 7: 完整任务管理与 dnd-kit 排序

**Files:**
- Create: `frontend/src/features/tasks/types.ts`, `tasks-api.ts`, `task-form.ts`
- Create: `frontend/src/features/tasks/TasksPage.tsx`, `TaskList.tsx`, `TaskCard.tsx`
- Create: `frontend/src/features/tasks/TaskFormDrawer.tsx`, `QuickAddDrawer.tsx`, `ClearTasksDialog.tsx`
- Create: `frontend/src/features/tasks/use-task-order.ts`
- Test: `frontend/src/features/tasks/TasksPage.test.tsx`, `use-task-order.test.tsx`

**Interfaces:**
- Consumes: 现有 `/api/tasks` CRUD、complete/reopen/export 和 Task 2 PUT `/api/tasks/order`。
- Produces: `TaskInput` 包含 title、priority、dueDate、needReport、note、category、source、nextStep、expectedOutcome、blocker、repeatType。
- Produces: `useTaskOrder()` 返回 `orderedTasks`, `onDragEnd`, `isSaving`。

- [ ] **Step 1: 写表单、排序回滚与清空确认测试**

```tsx
it("rolls back order and reports failure", async () => {
  const { result } = renderHook(() => useTaskOrder([a, b], reorderMock));
  reorderMock.mockRejectedValueOnce(new ApiError(409, "TASK_ORDER_CONFLICT"));
  await act(() => result.current.onDragEnd(dragEvent(a.id, b.id)));
  expect(result.current.orderedTasks.map(t => t.id)).toEqual([a.id, b.id]);
  expect(toast.error).toHaveBeenCalledWith("排序未保存，已恢复原顺序");
});
```

TasksPage 还验证：空标题禁止提交、编辑 Drawer 保留上下文、提交失败保留输入、完成可撤销、清空必须 Modal 且按钮为“清空全部任务”。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- TasksPage.test.tsx use-task-order.test.tsx`
Expected: FAIL，任务模块不存在。

- [ ] **Step 3: 实现任务查询和 Drawer 表单**

React Hook Form + Zod 校验 title 非空、dueDate 为 YYYY-MM-DD、文本长度与后端一致。新增和编辑共用 TaskFormDrawer；取消或 X 在 dirty 时提示放弃修改，点击蒙层不关闭。保存后失效 tasks/dashboard/reminders 查询；失败在表单操作区显示错误。

任务 Tabs 保留 today/daily/weekly/week/overdue/high/report/done/all；focus 参数滚动并高亮对应卡片。JSON 备份通过带 credentials 的请求生成 Blob 下载，不把认证 token 拼到 URL。

- [ ] **Step 4: 实现可访问拖拽与冲突恢复**

使用 `DndContext`、`SortableContext`、`sortableKeyboardCoordinates` 和 `verticalListSortingStrategy`。前端始终保留全量任务顺序；在筛选列表拖动时，将移动后的可见项插回全量列表，再提交全部 `{id, version}`。

```ts
onMutate: async (next) => {
  await queryClient.cancelQueries({ queryKey: ["tasks"] });
  const previous = queryClient.getQueryData<Task[]>(["tasks"]);
  queryClient.setQueryData(["tasks"], next);
  return { previous };
},
onError: (_e, _next, context) => {
  queryClient.setQueryData(["tasks"], context?.previous);
  toast.error("排序未保存，已恢复原顺序");
},
onSuccess: (tasks) => queryClient.setQueryData(["tasks"], tasks),
```

保存中禁止同一列表再次提交；409 后重新拉取任务，让用户基于最新顺序操作。

- [ ] **Step 5: 验证任务全链路**

Run: `npm test -- tasks && npm run build`
Expected: PASS；全部 9 个视图、CRUD、完成/重开、备份和排序可用，键盘可排序。

---

### Task 8: AI 快速新增、文件提取与每日精选

**Files:**
- Create: `frontend/src/features/tasks/ai-api.ts`, `DocumentImport.tsx`, `ImportPreview.tsx`
- Create: `frontend/src/features/content/types.ts`, `content-api.ts`, `ContentPage.tsx`
- Test: `frontend/src/features/tasks/DocumentImport.test.tsx`, `frontend/src/features/content/ContentPage.test.tsx`

**Interfaces:**
- Consumes: `/api/ai/status`、`doc-to-tasks`、`extract-text`、`doc-to-tasks/import`；`/api/content/daily` 和 `/daily/refresh`。
- Rule: 文件仅允许 `.txt/.md/.csv/.docx/.xlsx`，前端检查扩展名和 10MB 上限，后端仍为最终校验者。
- Rule: 能力维度只作为后端现有推荐上下文，不在前端展示或提供入口。

- [ ] **Step 1: 写导入预览和 AI 降级测试**

测试覆盖：选择不支持文件显示错误；提取后文本进入编辑器；AI 分析展示可勾选 TaskDraft；导入前不创建任务；导入成功后失效任务查询；远程 AI 失败时显示 Alert，并允许选择“本地快速识别”。每日精选测试文章/视频链接、空内容和刷新中状态。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- DocumentImport.test.tsx ContentPage.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 DocumentImport 与 ContentPage**

DocumentImport 放在 QuickAddDrawer，文档/收文两个 Tabs；上传用 FormData，api client 对 FormData 不设置 Content-Type。ImportPreview 支持勾选、修改标题、优先级和截止日期，点击“导入所选任务”调用 import，按钮显示实际导入数量。

ContentPage 分区展示文章与视频，外链加 `target="_blank" rel="noreferrer"`；AI 换一批使用 mutation，pending 时按钮显示“正在生成精选”，失败保留旧内容并 Toast/Alert 提示。

- [ ] **Step 4: 验证**

Run: `npm test -- DocumentImport.test.tsx ContentPage.test.tsx && npm run build`
Expected: PASS；无远程 AI 时本地识别仍可用，页面无能力评估展示。

---

### Task 9: 账号管理、日复盘、人才九宫格与花名册

**Files:**
- Create: `frontend/src/features/admin/types.ts`, `admin-api.ts`, `UsersPage.tsx`, `UserFormDrawer.tsx`
- Create: `frontend/src/features/review/types.ts`, `review-api.ts`, `ReviewPage.tsx`
- Create: `frontend/src/features/talent/types.ts`, `talent-api.ts`, `TalentPage.tsx`, `NineGrid.tsx`, `RosterDrawer.tsx`
- Test: `frontend/src/features/admin/UsersPage.test.tsx`, `frontend/src/features/review/ReviewPage.test.tsx`, `frontend/src/features/talent/TalentPage.test.tsx`

**Interfaces:**
- Consumes: 现有 `/api/admin/users`、`/api/review/daily`、`/api/talent` API。
- Rule: 不调用 `/reset-assessment`，账号列表不显示 assessmentStatus 或恢复评估按钮。
- Rule: 长表单、成员编辑和名册管理用 Drawer；清空名册等破坏性操作用明确确认的 Modal。

- [ ] **Step 1: 写权限与业务回归测试**

账号测试：level 1 可新增/重置密码/删除，不能删除自己，前端无评估恢复入口。复盘测试：404 显示“尚未生成今日复盘”，生成后显示 highlights/improvements/tomorrowGoals，focusCapability 不显示。人才测试：绩效与潜力 1–3 落入正确宫格，添加/编辑/删除成员同步失效 talent 查询，名册删除文案包含连带删除数量风险。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- UsersPage.test.tsx ReviewPage.test.tsx TalentPage.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现三个一级/二级权限页面**

UsersPage 使用 Table，新增用户 Drawer 校验用户名 `[a-zA-Z0-9_]{2,20}`、密码至少 6 位、等级 1–3；重置密码和删除按钮写具体动作。

ReviewPage 使用独立业务页面而非 Modal，生成时保留已有草稿并显示进度；仅展示工作相关字段，隐藏 focusCapability。

NineGrid 用 CSS Grid 3×3，绩效从左到右、潜力从下到上；人员记录可编辑。RosterDrawer 管理分组和成员，所有请求用 encodeURIComponent 编码路径中的 roster/name。

- [ ] **Step 4: 验证**

Run: `npm test -- UsersPage.test.tsx ReviewPage.test.tsx TalentPage.test.tsx && npm run build`
Expected: PASS；level 2/3 通过直接 URL 也被 RequireRole 拒绝，后端仍强制鉴权。

---

### Task 10: 全局搜索与全站响应式、弹层和动效收尾

**Files:**
- Create: `frontend/src/features/search/search-api.ts`, `SearchDialog.tsx`, `use-global-search.ts`
- Modify: `frontend/src/app/AppShell.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/features/search/SearchDialog.test.tsx`
- Create: `frontend/e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: Task 3 GET `/api/search?q=` 和 Task 5 路由。
- Produces: Ctrl/Cmd + K 打开，Escape 关闭；上/下键移动，Enter 跳转；300ms debounce。
- Rule: 搜索面板不展示能力评估；移动导航 Drawer 与搜索 Dialog 不同时打开。

- [ ] **Step 1: 写搜索快捷键、防抖和键盘测试**

使用 fake timers 和 userEvent：输入“德”后 299ms 不请求，300ms 请求一次；继续输入取消旧请求；上下键改变 active descendant，Enter 导航；空结果显示“未找到匹配内容”；level 3 只显示任务分组。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- SearchDialog.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 SearchDialog**

使用 Dialog + 输入框，不嵌套表单；`useDeferredValue` 不替代 300ms 网络防抖。每次新关键词用 AbortController 取消旧请求，query key 为 `["search", trimmedQuery]`。结果按钮包含类型图标、标题、subtitle，点击后关闭并导航到服务端返回 path。所有结果列表具备 role/aria-selected/aria-activedescendant。

- [ ] **Step 4: 全站响应式和动效检查**

CSS 断点：`<768px` 单列 + 手机 Drawer；`768–1199px` 可折叠侧栏；`>=1200px` 固定 240px 侧栏，内容最大宽度 1600px。Motion 只用于卡片列表进入和 Drawer/Popover 状态，`prefers-reduced-motion` 下关闭非必要动画。Playwright 在 390×844、768×1024、1440×900 验证无横向滚动、主要按钮可见、深色主题对比和焦点顺序。

- [ ] **Step 5: 验证**

Run: `npm test && npm run test:e2e -- responsive.spec.ts && npm run build`
Expected: PASS；无能力入口、无阻断性溢出、键盘操作完整。

---

### Task 11: 后端静态托管剥离、独立部署与最终验证

**Files:**
- Modify: `src/main/java/com/personal/dashboard/auth/WebConfig.java`
- Modify: `src/main/resources/application.properties`
- Create: `deploy/frontend-nginx.conf`, `deploy/api-nginx.conf`
- Modify: `deploy/部署手册.md`
- Create: `frontend/.env.example`, `README.md`
- Create: `frontend/e2e/core-flows.spec.ts`

**Interfaces:**
- Produces: 前端 `npm run build` → `frontend/dist`；后端 `"$MVN" package` → `target/growth-dashboard-1.0.0.jar`。
- Production config: `FRONTEND_ORIGINS=https://dashboard.example.com`、`COOKIE_SECURE=true`、`VITE_API_PROXY_TARGET` 仅用于开发。
- Runtime contract: 生产前端使用同源 `/api` 由前端 Nginx 反代到 `api.example.com`，或构建时注入公开 API base；Cookie/CSRF 两种方式都通过同一 API client。

- [ ] **Step 1: 写核心端到端流程**

Playwright 覆盖：登录、创建任务、编辑、完成、拖动或键盘排序、刷新后顺序保持、全局搜索、主题切换、退出；管理员验证账号/复盘/人才，level 3 验证直接访问受限路由被拒绝。测试账号和数据库使用独立临时实例，不触碰 `data/dashboarddb.mv.db` 中的真实数据。

- [ ] **Step 2: 移除旧前端资源映射但保留旧文件**

WebConfig 删除 `addResourceHandlers`，不添加 SPA fallback；后端只暴露 `/api/**`。本次先不删除 `src/main/resources/static` 旧文件，待独立部署验证通过后再由单独清理任务移除，避免把回退选择与全站迁移混在一起。

- [ ] **Step 3: 写部署配置**

前端 Nginx 配置静态缓存：`index.html` no-cache，`/assets/` immutable；SPA fallback 到 index.html。API Nginx 只代理 `/api`，传递 Host、X-Request-ID 和 HTTPS 相关头，不对外暴露 7100。部署手册明确两套独立发布与回滚、环境变量、数据库备份和 CSRF/Cookie 检查，不包含真实域名密码或密钥。

`frontend/.env.example` 仅包含：

```dotenv
VITE_API_PROXY_TARGET=http://localhost:7100
```

- [ ] **Step 4: 完整自动化验证**

```bash
cd /d/kimi/Workspaces/待办优化/growth-dashboard
export JAVA_HOME='C:\Users\22580\.jdks\ms-17.0.18'
export PATH="$JAVA_HOME/bin:$PATH"
MVN='/d/kimi/Workspaces/看板生成/tools-maven/bin/mvn'
"$MVN" clean test
"$MVN" package
cd frontend
npm ci
npm run lint
npm test
npm run build
npm run test:e2e
```

Expected: 后端测试和打包 PASS；前端 lint、单元/组件测试、构建和 E2E 全部 PASS；能力相关后端接口仍存在。

- [ ] **Step 5: 手动验收与进程清理**

临时启动后端与 `npm run dev -- --host 0.0.0.0 --port 5173`，验证登录 Cookie、CSRF、CORS、390/768/1440 三种宽度、深浅主题和加载/错误/空状态。随后检查 `frontend/src`、`src`、`deploy` 和根目录启动脚本，不得出现 `D:\kimi\Workspaces\看板生成`、`growth-supermarket`、`reference-ui` 或指向其他项目的相对路径；将根目录复制到一个新位置后，使用标准 Java 17、Maven 3.9 和 Node 命令重新执行 `npm ci`、前端构建与 Maven 打包，验证迁移不依赖原目录。完成后停止所有临时进程，确认没有监听 5173/7100 的本次测试进程；最终交付前端预览使用 `npm run dev`，由 Kimi Work 在需要时管理生命周期。

---

## Plan Self-Review

- Spec coverage: Tasks 1–3 覆盖独立 API、安全、排序和搜索；Tasks 4–5 覆盖设计系统、路由、主题、认证和弹层；Tasks 6–9 覆盖所有保留模块并明确排除能力评估；Task 10 覆盖全局搜索、响应式、无障碍和动效；Task 11 覆盖独立部署与完整验收。
- No placeholders: 所有接口、路径、类型和测试命令均明确；实现时不得以“后续再补”跳过测试。
- Type consistency: 前端统一使用 TaskItem JSON 的 camelCase；排序统一提交 `{tasks:[{id,version}]}`；搜索统一返回 `{tasks,people,content}`；错误统一读取 ApiError。
- Git: 用户已确认暂无仓库，因此本计划不包含提交步骤。
