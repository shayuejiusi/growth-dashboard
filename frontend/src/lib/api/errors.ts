import type { ApiErrorPayload } from "./types"

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly path?: string

  constructor(status: number, message: string, payload: ApiErrorPayload = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = payload.code ?? "HTTP_ERROR"
    this.requestId = payload.requestId
    this.path = payload.path
  }
}

const fallbackMessages: Record<number, string> = {
  400: "请求内容有误",
  401: "未登录或会话已过期",
  403: "没有执行此操作的权限",
  404: "请求的内容不存在",
  409: "数据已发生变化，请刷新后重试",
  500: "服务器暂时无法处理请求",
}

export async function toApiError(response: Response, path: string): Promise<ApiError> {
  let payload: ApiErrorPayload = {}
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text) as ApiErrorPayload
    } catch {
      // 非 JSON 错误响应使用稳定中文回退，不暴露 SyntaxError。
    }
  }
  const message = payload.message ?? fallbackMessages[response.status] ?? `请求失败（${response.status}）`
  return new ApiError(response.status, message, {
    ...payload,
    requestId: payload.requestId ?? response.headers.get("X-Request-ID") ?? undefined,
    path: payload.path ?? path,
  })
}

export async function parseApiResponse<T>(response: Response, path: string): Promise<T> {
  if (!response.ok) throw await toApiError(response, path)
  if (response.status === 204 || response.status === 205) return undefined as T

  const text = await response.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError(response.status, "服务器返回了无法解析的响应", {
      code: "INVALID_RESPONSE",
      requestId: response.headers.get("X-Request-ID") ?? undefined,
      path,
    })
  }
}
