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

export async function toApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorPayload = {}
  try {
    payload = await response.json() as ApiErrorPayload
  } catch {
    // 非 JSON 响应仍转换为稳定的客户端错误。
  }
  const message = payload.message ?? fallbackMessages[response.status] ?? `请求失败（${response.status}）`
  return new ApiError(response.status, message, payload)
}
