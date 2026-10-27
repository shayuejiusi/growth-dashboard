import { AlarmClock, CheckCircle2, Flag, ListTodo } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { TaskStats } from "./types"

const cards = [
  { key: "todayDue", label: "今日待办", icon: ListTodo, suffix: "项", tone: "bg-primary/10 text-primary" },
  { key: "overdue", label: "逾期任务", icon: AlarmClock, suffix: "项", tone: "bg-destructive/10 text-destructive" },
  { key: "highPriority", label: "高优先级", icon: Flag, suffix: "项", tone: "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300" },
  { key: "completionRate", label: "完成率", icon: CheckCircle2, suffix: "%", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300" },
] as const

export function StatCards({ stats }: { stats: TaskStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="任务统计">
      {cards.map(({ key, label, icon: Icon, suffix, tone }) => (
        <Card key={key} className="gap-0 py-0 shadow-xs">
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11 ${tone}`} aria-hidden="true">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                {stats[key]}<span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
