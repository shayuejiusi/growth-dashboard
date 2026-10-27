export interface ApiOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  /** 仅用于建立会话的登录请求；其他写请求必须携带 CSRF。 */
  skipCsrf?: boolean
  /** 登录失败由登录表单展示，不触发全局会话失效跳转。 */
  skipUnauthorizedEvent?: boolean
}

export interface ApiErrorPayload {
  status?: number
  code?: string
  message?: string
  path?: string
  requestId?: string
  timestamp?: string
}
