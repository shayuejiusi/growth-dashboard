import { AlertCircle, Inbox, LoaderCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface StatePanelProps {
  status: "loading" | "error" | "empty"
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function StatePanel({ status, title, description, onRetry, className }: StatePanelProps) {
  if (status === "error") {
    return (
      <div className={cn("flex justify-center p-8", className)}>
        <Alert variant="destructive" className="max-w-lg" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>{title ?? "暂时无法加载"}</AlertTitle>
          <AlertDescription>{description ?? "请稍后重试。"}</AlertDescription>
          {onRetry ? <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>重新加载</Button> : null}
        </Alert>
      </div>
    )
  }

  const loading = status === "loading"
  const Icon = loading ? LoaderCircle : Inbox
  return (
    <div role="status" aria-live="polite" className={cn("flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center", className)}>
      <Icon className={cn("size-7 text-muted-foreground", loading && "animate-spin")} aria-hidden="true" />
      <div>
        <p className="font-medium">{title ?? (loading ? "正在加载" : "暂无内容")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description ?? (loading ? "请稍候…" : "这里还没有可显示的内容。")}</p>
      </div>
    </div>
  )
}
