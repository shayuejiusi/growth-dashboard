# 全站终审修复报告

## 范围与基准

- Base：`fd9053c38f83329ec46895e60a85b5525091d8d7`
- 仅修改前端认证边界、API 客户端、Talent/Content 搜索定位及对应测试；后端接口、业务 Query key、依赖均未修改。
- 能力成长/评估入口保持隐藏；AI 提示词/API 继续为空白，未启用生成能力。

## 根因与修复

### 1. 跨账号业务缓存与晚到响应

根因：登录、登出和 401 原先仅写入 `auth/session`，固定 key 的 dashboard/tasks/review/talent/search 等 Query 及 Mutation 状态仍保留。仅清 Mutation 状态也不能阻止晚到请求的 `onSuccess` 再写业务缓存。

修复：

- 新增统一 `replaceSession`：先推进认证代次并清理 CSRF，再同步取消活动 Query、`queryClient.clear()` 清理 Query/Mutation，最后写入新会话。
- 登录成功、登出成功、`auth:unauthorized` 全部走该边界；不清空 Zustand UI 偏好，同账号正常缓存不失效。
- API 请求记录认证代次；旧代次成功响应抛出 `STALE_SESSION`，不得进入成功回调，旧代次 401 也不得触发新会话登出。CSRF 请求共享与晚到清理同样受代次保护。
- 任务备份 Blob 下载接入同一请求边界，消除单独 fetch 造成的 401 盲区。
- 会话恢复仍通过 `useSession`；整页恢复会创建新 QueryClient，不恢复旧业务缓存。同账号 30 秒搜索缓存继续有效，并有测试防止以禁用缓存掩盖问题。

### 2. 搜索目标页不消费参数

- Talent：按解码后的 `person` 精确匹配记录，数据加载后复用现有观察记录 Drawer；缺失/已删除时显示可恢复 Alert，不打开其他记录。以 `location.key` 处理相同 URL 重复导航。
- Content：按现有搜索契约以 `item` 标题精确匹配文章或视频，数据加载后滚动、聚焦并高亮目标卡片；缺失时显示 Alert。相同 URL 重复导航会再次定位。
- 保留 SearchDialog 原有路径白名单、参数值校验和外部链接防护。

## 真实 RED 记录

1. 新增认证集成测试初次运行：`src/app/auth-cache-isolation.test.tsx` 中管理员→三级、A→B、30 秒搜索缓存、直接 401 均复现旧账号数据渲染或旧搜索缓存复用。
2. 晚到场景先修正了测试 mock；普通页面 Query 在卸载时会被现有 Abort 机制取消，作为通过控制，未虚报 RED。随后改用旧账号创建任务 Mutation：仅做 Query/Mutation 清理后，该测试仍 RED，页面实际出现“账号 A 的晚到任务”，证明需要 API 代次拦截。
3. 新增目标定位测试初次运行：Talent 2 项、Content 3 项全部 RED（找不到目标 Drawer、目标卡片或缺失提示），既有 11 项保持通过。
4. 自审新增备份 401 测试：RED，`auth:unauthorized` 监听器预期 1 次、实际 0 次。
5. lint 曾 RED：Talent/Content 各有一处 effect 内同步 setState；改为渲染期处理导航请求、effect 仅操作 DOM。

## GREEN 与最终验证

- 认证/搜索聚焦回归：6 个文件、87 项通过。
- 备份与认证补充聚焦回归：3 个文件、42 项通过。
- 最终完整前端测试：`npm test` → 19 个文件、225 项测试全部通过。
- 最终 lint：`npm run lint` → 通过，0 错误。
- 最终 build：`npm run build` → TypeScript 与 Vite 构建成功。
- 构建仅有 Zod 第三方注释位置提示和既存 chunk > 500 kB 警告，无构建失败。
- 后端未改，未运行 Maven。未执行 Edge E2E；本轮由真实 App 路由/请求集成测试、完整 Vitest、lint 和生产 build 覆盖修改面。

## 最终自审

- 登录、登出、直接业务 401、CSRF 401、会话恢复、旧成功响应、旧 401、Blob 下载均已核对；401 去重逻辑保留，不形成 unauthorized 循环。
- 新会话建立前清理旧缓存；测试断言旧数据不渲染且新会话重新请求。
- Talent/Content 均覆盖 URL 编码、加载后定位、缺失目标及重复导航；无错误记录自动打开。
- 未引入依赖，未修改无关架构，未禁用正常同账号缓存。
- 按要求创建本地提交，不 push。
