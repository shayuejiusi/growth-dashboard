import { ArrowRight, Check, Clock3 } from "lucide-react"
import { Link } from "react-router"

import { StatePanel } from "@/components/feedback/StatePanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { TaskItem } from "./types"

const priorityVariant = { P0: "destructive", P1: "default", P2: "secondary" } as const

interface TopThreeProps {
  tasks: TaskItem[]
  onComplete: (id: string) => void
  completingId?: string
}

export function TopThree({ tasks, onComplete, completingId }: TopThreeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h2 className="text-lg">今日最重要的 3 件事</h2></CardTitle>
        <CardDescription>按优先级聚焦推进，完成后及时同步进展。</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div>
            <StatePanel
              status="empty"
              title="今天还没有重点任务"
              description="前往任务管理，添加第一件需要推进的事。"
              className="min-h-44"
            />
            <Button asChild variant="outline" size="sm" className="mx-auto -mt-4 flex w-fit">
              <Link to="/tasks">前往任务管理<ArrowRight aria-hidden="true" /></Link>
            </Button>
          </div>
        ) : (
          <ol className="divide-y">
            {tasks.map((task, index) => (
              <li key={task.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground" aria-label={`第 ${index + 1} 项`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
                    <Link to={`/tasks?focus=${encodeURIComponent(task.id)}`} className="font-medium underline-offset-4 hover:underline">
                      {task.title}
                    </Link>
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock3 className="size-4" aria-hidden="true" />
                    {task.dueDate ? <time dateTime={task.dueDate}>截止 {task.dueDate}</time> : "未设置截止时间"}
                    {task.needReport ? <span aria-label="需要汇报">· 需汇报</span> : null}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={completingId === task.id}
                  aria-label={`完成“${task.title}”`}
                  onClick={() => onComplete(task.id)}
                >
                  <Check aria-hidden="true" />{completingId === task.id ? "正在完成" : "完成"}
                </Button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
