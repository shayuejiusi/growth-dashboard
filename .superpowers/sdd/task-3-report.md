# Task 3 实施报告：权限感知全局搜索 API

## 基线与范围

- Base commit：`169df98ee647ea5c7013816c9bebca8541df224d`
- 唯一需求来源：`.superpowers/sdd/task-3-brief.md`
- 实施方式：严格先写集成测试并观察 RED，再编写生产代码并观察 GREEN，最后执行完整 Maven 回归。
- 未修改前端、无关文档或无关后端模块；未删除或隐藏任何能力成长与评估接口。

## 实现内容

1. 新增 `GET /api/search?q=关键词`，返回 `SearchResponse(tasks, people, content)` 三组数组；统一结果结构为 `SearchResult(type, id, title, subtitle, path)`。
2. 控制器只接收 `q` 与 `currentUser`，对 `q.trim()` 后长度小于 1 或大于 50 的查询抛出统一 400；去除首尾空白后长度为 50 的查询可正常执行。
3. 服务使用 `trim().toLowerCase(Locale.ROOT)` 规范化关键词，以 `contains` 匹配任务标题与来源、人员姓名、文章标题与来源。
4. 任务通过 `StatsService.tasks(currentUser.username())` 获取，只搜索当前登录用户自己的任务。
5. 一级用户搜索任务、人才与内容；二级用户搜索任务与内容，`people` 始终为空；三级用户仅搜索自己的任务，`people` 与 `content` 始终为空。
6. 每组按数据原有顺序最多返回 5 条；无匹配时返回三个空数组，不返回 404。
7. 路径完全由服务端生成：任务 `/tasks?focus={id}`、人员 `/talent?person={id}`、内容 `/content?item={URLEncoder UTF-8 编码标题}`。
8. `AuthInterceptor` 的三级允许路径仅增加 `/api/search`，服务内部继续执行分类权限过滤。
9. 搜索服务不读取 capability、assessment、密码、任务备注、人员观察记录或视频数据。

## 测试覆盖

`SearchIntegrationTest` 共 6 个测试，使用 Task 1 的 HttpOnly Cookie 会话，写操作携带 CSRF：

- 三级分类权限与空数组、一级/二级分类差异、当前用户任务隔离、capability 不作为搜索来源。
- 任务来源、人员姓名、文章标题与来源匹配。
- 无结果返回三个空数组；大小写与首尾空白规范化；trim 后 50 字符边界。
- 空白查询与 51 字符查询返回 400。
- 三个分组分别验证最多 5 条。
- 三类结果的服务端固定路径及内容标题 UTF-8 URL 编码。

## RED 记录

执行命令：

```bash
export JAVA_HOME='C:\Users\22580\.jdks\ms-17.0.18'
export PATH="$JAVA_HOME/bin:$PATH"
MVN='/d/kimi/Workspaces/看板生成/tools-maven/bin/mvn'
"$MVN" -Dtest=SearchIntegrationTest test
```

关键真实输出：

```text
Running com.personal.dashboard.api.SearchIntegrationTest
Tests run: 6, Failures: 6, Errors: 0, Skipped: 0
Status expected:<200> but was:<404>
Status expected:<200> but was:<403>
Status expected:<400> but was:<404>
[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.5.3:test
Command failed with exit code: 1.
```

失败原因符合预期：5 个测试在搜索路由不存在时得到 404；三级权限测试在搜索路径尚未放行时得到 403。测试编译和 Spring 上下文启动成功，不是语法或测试配置错误。

## GREEN 记录

实现后执行命令：

```bash
export JAVA_HOME='C:\Users\22580\.jdks\ms-17.0.18'
export PATH="$JAVA_HOME/bin:$PATH"
MVN='/d/kimi/Workspaces/看板生成/tools-maven/bin/mvn'
"$MVN" -Dtest=SearchIntegrationTest test
```

关键真实输出：

```text
Running com.personal.dashboard.api.SearchIntegrationTest
Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## 完整回归

执行命令：

```bash
export JAVA_HOME='C:\Users\22580\.jdks\ms-17.0.18'
export PATH="$JAVA_HOME/bin:$PATH"
MVN='/d/kimi/Workspaces/看板生成/tools-maven/bin/mvn'
"$MVN" test
```

关键真实输出：

```text
Tests run: 3, Failures: 0, Errors: 0, Skipped: 0 -- ApiErrorContractIntegrationTest
Tests run: 6, Failures: 0, Errors: 0, Skipped: 0 -- SearchIntegrationTest
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0 -- TaskOrderIntegrationTest
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0 -- AuthApiIntegrationTest
Tests run: 23, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

完整回归合计 23 个测试，0 失败、0 错误、0 跳过。

## 变更文件

- 新增：`src/main/java/com/personal/dashboard/model/SearchResult.java`
- 新增：`src/main/java/com/personal/dashboard/service/SearchService.java`
- 新增：`src/main/java/com/personal/dashboard/api/SearchController.java`
- 修改：`src/main/java/com/personal/dashboard/auth/AuthInterceptor.java`
- 新增：`src/test/java/com/personal/dashboard/api/SearchIntegrationTest.java`
- 新增：`.superpowers/sdd/task-3-report.md`

## 自审

- [x] 接口路径、响应三组字段和 `SearchResult` 五字段与 brief 一致。
- [x] 一级、二级、三级分类权限及三级路径放行与 brief 一致。
- [x] 所有角色的任务都经 `StatsService` 按当前用户名隔离。
- [x] 每组最多 5 条，空结果为三个空数组。
- [x] 关键词 trim、Locale.ROOT 小写化、长度边界及 400 行为符合要求。
- [x] 三类 path 固定由服务端生成，内容标题采用 UTF-8 URL 编码。
- [x] 未扫描 capability、assessment 或密码字段，结果 path 不含 assessment。
- [x] 测试先于生产代码执行并真实失败，实现后聚焦测试及完整回归均通过。
- [x] `git diff --check` 通过；变更范围没有前端、无关文档或无关模块。
- [x] 未删除或隐藏能力成长与评估接口。

## 疑虑

无未解决疑虑。完整回归中既有 `AuthApiIntegrationTest` 会故意触发一次异常以验证 500 错误响应不泄露细节，因此日志包含预期异常堆栈，但该测试及完整回归均通过。
