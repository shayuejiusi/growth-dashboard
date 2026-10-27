import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Clipboard, Copy, Lightbulb } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { StatePanel } from "@/components/feedback/StatePanel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getReminders, reminderKeys } from "./reminders-api"
import type { ReminderGroup, ReminderScript, RemindersData } from "./types"

const groups: Array<{
  key: ReminderGroup
  label: string
  emptyTitle: string
  emptyDescription: string
  action: string
}> = [
  { key: "todayDue", label: "今日截止", emptyTitle: "今天没有截止任务", emptyDescription: "可切换到其他分组，或前往任务管理安排截止时间。", action: "安排任务" },
  { key: "overdue", label: "已逾期", emptyTitle: "没有逾期任务", emptyDescription: "保持当前节奏；新增任务时请设置明确的截止时间。", action: "查看任务" },
  { key: "highPriority", label: "高优先级", emptyTitle: "没有高优先级任务", emptyDescription: "当前没有 P0/P1 待办，可前往任务管理检查优先级。", action: "检查任务" },
  { key: "needReport", label: "需要汇报", emptyTitle: "没有需要汇报的任务", emptyDescription: "如任务需要同步进展，可在任务管理中设置汇报要求。", action: "设置汇报" },
  { key: "recurring", label: "周期事项", emptyTitle: "没有周期事项", emptyDescription: "每日或每周固定工作可在任务管理中设为周期事项。", action: "管理周期事项" },
]

const priorityVariant = { P0: "destructive", P1: "default", P2: "secondary" } as const

function RemindersLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-64 w-full" />
      <StatePanel status="loading" title="正在加载提醒" description="正在检查需要关注的事项…" className="min-h-20 p-2" />
    </div>
  )
}

function ReminderList({ data, group }: { data: RemindersData; group: (typeof groups)[number] }) {
  const tasks = data.reminders[group.key]
  if (tasks.length === 0) {
    return (
      <div>
        <StatePanel status="empty" title={group.emptyTitle} description={group.emptyDescription} />
        <Button asChild variant="outline" size="sm" className="mx-auto -mt-4 flex w-fit">
          <Link to="/tasks">{group.action}<ArrowUpRight aria-hidden="true" /></Link>
        </Button>
      </div>
    )
  }
  return (
    <ul className="divide-y">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
              <span className="font-medium">{task.title}</span>
              {task.repeatType === "DAILY" ? <Badge variant="outline">每日</Badge> : null}
              {task.repeatType === "WEEKLY" ? <Badge variant="outline">每周</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {task.dueDate ? <time dateTime={task.dueDate}>截止 {task.dueDate}</time> : "未设置截止时间"}
              {task.needReport ? " · 需汇报" : ""}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="w-full sm:w-auto">
            <Link to={`/tasks?focus=${encodeURIComponent(task.id)}`} aria-label={`查看“${task.title}”`}>
              查看任务<ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  )
}

function ScriptCard({ script, fallbackOpen, onFallback }: { script: ReminderScript; fallbackOpen: boolean; onFallback: (open: boolean) => void }) {
  async function copyScript() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable")
      await navigator.clipboard.writeText(script.text)
      onFallback(false)
      toast.success("话术已复制")
    } catch {
      onFallback(true)
      toast.error("自动复制失败，请手动复制")
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{script.scene}</CardTitle>
        <CardDescription>复制后可按实际进展调整，再发送给相关人员。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap rounded-lg bg-muted/70 p-4 text-sm leading-6">{script.text}</p>
        {fallbackOpen ? (
          <Alert>
            <AlertTitle>自动复制失败，请手动选择并复制。</AlertTitle>
            <AlertDescription>
              <Textarea
                aria-label="手动复制话术"
                value={script.text}
                readOnly
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                className="mt-2 min-h-28 w-full bg-background"
              />
            </AlertDescription>
          </Alert>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => void copyScript()}>
          {fallbackOpen ? <Clipboard aria-hidden="true" /> : <Copy aria-hidden="true" />}复制话术
        </Button>
      </CardContent>
    </Card>
  )
}

export function RemindersPage() {
  const reminders = useQuery({ queryKey: reminderKeys.detail(), queryFn: ({ signal }) => getReminders(signal) })
  const [fallbackScript, setFallbackScript] = useState<number | null>(null)

  return (
    <section aria-labelledby="reminders-title" className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="reminders-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">提醒中心</h1>
          <p className="mt-2 text-sm text-muted-foreground">集中检查今日、逾期与需要同步的事项。</p>
        </div>
        {reminders.data ? <Badge variant="secondary">{reminders.data.phase}</Badge> : null}
      </header>

      {reminders.isPending ? <RemindersLoading /> : null}
      {reminders.isError ? (
        <StatePanel
          status="error"
          title="提醒加载失败"
          description={reminders.error instanceof Error ? reminders.error.message : "请稍后重试。"}
          onRetry={() => void reminders.refetch()}
          className="min-h-72"
        />
      ) : null}
      {reminders.data ? (
        <>
          <Alert className="border-primary/20 bg-primary/5">
            <Lightbulb aria-hidden="true" />
            <AlertTitle>当前焦点</AlertTitle>
            <AlertDescription>{reminders.data.focusNow}</AlertDescription>
          </Alert>
          <Card>
            <CardContent>
              <Tabs defaultValue="todayDue">
                <TabsList className="h-auto w-full justify-start overflow-x-auto" aria-label="提醒分组">
                  {groups.map((group) => (
                    <TabsTrigger key={group.key} value={group.key} className="min-h-9 shrink-0 px-3">
                      {group.label}<Badge variant="secondary" className="ml-1 px-1.5">{reminders.data.reminders[group.key].length}</Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
                {groups.map((group) => (
                  <TabsContent key={group.key} value={group.key} className="pt-5">
                    <ReminderList data={reminders.data} group={group} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <section aria-labelledby="scripts-title" className="space-y-4">
            <div>
              <h2 id="scripts-title" className="text-lg font-semibold">沟通话术</h2>
              <p className="mt-1 text-sm text-muted-foreground">基于当前任务数据生成，发送前请核对实际情况。</p>
            </div>
            {reminders.data.scripts.length === 0 ? (
              <Card><CardContent><StatePanel status="empty" title="暂无可复制的话术" description="提醒数据仍可正常查看，话术将在生成后显示。" /></CardContent></Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {reminders.data.scripts.map((script, index) => (
                  <ScriptCard
                    key={`${script.scene}-${index}`}
                    script={script}
                    fallbackOpen={fallbackScript === index}
                    onFallback={(open) => setFallbackScript(open ? index : null)}
                  />
                ))}
              </div>
            )}
          </section>
          <p className="text-right text-xs text-muted-foreground">数据更新于 {reminders.data.generatedAt}</p>
        </>
      ) : null}
    </section>
  )
}
