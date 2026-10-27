import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Plus, Trash2, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation, useSearchParams } from "react-router"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog"
import { StatePanel } from "@/components/feedback/StatePanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClearTasksDialog } from "./ClearTasksDialog"
import { QuickAddDrawer } from "./QuickAddDrawer"
import { TaskFormDrawer } from "./TaskFormDrawer"
import { TaskList } from "./TaskList"
import { getTaskWriteCoordinator } from "./task-write-coordinator"
import { clearTasks, completeTask, createTask, deleteTask, exportTasks, getTasks, reopenTask, taskKeys, updateTask } from "./tasks-api"
import { useTaskOrder } from "./use-task-order"
import type { Task, TaskInput, TaskView } from "./types"

const views: Array<{ key: TaskView; label: string; emptyTitle: string; emptyDescription: string }> = [
  { key: "today", label: "今日待办", emptyTitle: "今天没有待办任务", emptyDescription: "可以添加新任务，或切换到全部任务检查后续安排。" },
  { key: "daily", label: "每日必做", emptyTitle: "没有每日必做", emptyDescription: "将固定每日推进的任务设为每日必做。" },
  { key: "weekly", label: "每周必做", emptyTitle: "没有每周必做", emptyDescription: "将固定每周推进的任务设为每周必做。" },
  { key: "week", label: "本周待办", emptyTitle: "本周没有待办任务", emptyDescription: "本周截止且未完成的任务会显示在这里。" },
  { key: "overdue", label: "已逾期", emptyTitle: "没有逾期任务", emptyDescription: "当前没有超过截止日期的未完成任务。" },
  { key: "high", label: "高优先级", emptyTitle: "没有高优先级任务", emptyDescription: "未完成的 P0、P1 任务会显示在这里。" },
  { key: "report", label: "需汇报", emptyTitle: "没有需要汇报的任务", emptyDescription: "编辑任务并勾选需要向领导汇报即可加入此视图。" },
  { key: "done", label: "已完成", emptyTitle: "还没有已完成任务", emptyDescription: "完成的任务会保留在这里，可随时重开。" },
  { key: "all", label: "全部任务", emptyTitle: "还没有任务", emptyDescription: "从一件明确、可推进的小事开始。" },
]

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function filterTasks(tasks: Task[], view: TaskView, now = new Date()) {
  const today = localDate(now)
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)

  return tasks.filter((task) => {
    const open = task.status !== "DONE"
    switch (view) {
      case "today": return open && (task.dueDate === null || task.dueDate === today)
      case "daily": return task.repeatType === "DAILY"
      case "weekly": return task.repeatType === "WEEKLY"
      case "week": {
        if (!open || !task.dueDate) return false
        return task.dueDate >= localDate(monday) && task.dueDate <= localDate(sunday)
      }
      case "overdue": return open && task.dueDate !== null && task.dueDate < today
      case "high": return open && (task.priority === "P0" || task.priority === "P1")
      case "report": return open && task.needReport
      case "done": return task.status === "DONE"
      case "all": return true
    }
  })
}

function TasksLoading() {
  return (
    <div className="space-y-4" aria-label="正在加载任务">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <StatePanel status="loading" title="正在加载任务" className="min-h-20 p-2" />
    </div>
  )
}

export function TasksPage() {
  const queryClient = useQueryClient()
  const writeCoordinator = getTaskWriteCoordinator(queryClient)
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get("focus")
  const focusRequestKey = focusId ? location.key : null
  const newRequestKey = searchParams.get("new") === "1" ? location.key : null
  const [activeView, setActiveView] = useState<TaskView>(focusId ? "all" : "today")
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [handledNewRequest, setHandledNewRequest] = useState<string | null>(null)
  const [handledFocusRequest, setHandledFocusRequest] = useState<string | null>(focusRequestKey)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  if (newRequestKey && newRequestKey !== handledNewRequest) {
    setHandledNewRequest(newRequestKey)
    setEditingTask(null)
    setFormOpen(true)
  }
  if (focusRequestKey && focusRequestKey !== handledFocusRequest) {
    setHandledFocusRequest(focusRequestKey)
    setActiveView("all")
  }
  const tasksQuery = useQuery({ queryKey: taskKeys.list(), queryFn: ({ signal }) => getTasks(signal) })
  const { orderedTasks, onDragEnd, isSaving } = useTaskOrder(tasksQuery.data ?? [])

  useEffect(() => {
    document.title = "任务管理 · 个人工作看板"
  }, [])

  useEffect(() => {
    if (!focusId || activeView !== "all" || !tasksQuery.data) return
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`task-${focusId}`)
      card?.scrollIntoView({ block: "center", behavior: "smooth" })
      card?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeView, focusId, orderedTasks, tasksQuery.data])

  function openNewTask() {
    setEditingTask(null)
    setFormOpen(true)
  }

  async function invalidateTaskData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reminders"] }),
    ])
  }

  async function runTaskWrite<T>(operation: () => Promise<T>): Promise<T> {
    if (!writeCoordinator.tryAcquire("mutation")) {
      const message = "另一项任务操作正在保存，请稍后重试"
      toast.info(message)
      throw new Error(message)
    }
    try {
      return await operation()
    } finally {
      writeCoordinator.release("mutation")
    }
  }

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TaskInput }) => id ? updateTask(id, input) : createTask(input),
    onSuccess: async (saved, variables) => {
      queryClient.setQueryData<Task[]>(taskKeys.list(), (current = []) => variables.id
        ? current.map((task) => task.id === saved.id ? saved : task)
        : [...current, saved])
      setFormOpen(false)
      setQuickAddOpen(false)
      setEditingTask(null)
      toast.success(variables.id ? "任务已保存" : "任务已创建")
      await invalidateTaskData()
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ task, action }: { task: Task; action: "complete" | "reopen" }) => action === "complete" ? completeTask(task.id) : reopenTask(task.id),
    onSuccess: async (updated, variables) => {
      queryClient.setQueryData<Task[]>(taskKeys.list(), (current = []) => current.map((task) => task.id === updated.id ? updated : task))
      await invalidateTaskData()
      if (variables.action === "complete") {
        toast.success("任务已完成", {
          action: {
            label: "撤销",
            onClick: () => changeStatus(updated, "reopen"),
          },
        })
      } else {
        toast.success("任务已恢复待办")
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "状态更新失败，请重试。"),
  })

  const deleteMutation = useMutation({
    mutationFn: (task: Task) => deleteTask(task.id),
    onSuccess: async (_result, task) => {
      queryClient.setQueryData<Task[]>(taskKeys.list(), (current = []) => current.filter((item) => item.id !== task.id))
      setDeletingTask(null)
      toast.success("任务已删除")
      await invalidateTaskData()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "删除失败，请重试。"),
  })

  const clearMutation = useMutation({
    mutationFn: clearTasks,
    onSuccess: async () => {
      queryClient.setQueryData<Task[]>(taskKeys.list(), [])
      setActiveView("all")
      setClearOpen(false)
      toast.success("已清空全部任务")
      await invalidateTaskData()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "清空失败，请重试。"),
  })

  const backupMutation = useMutation({
    mutationFn: async () => {
      const blob = await exportTasks()
      let url: string | null = null
      let anchor: HTMLAnchorElement | null = null
      try {
        url = URL.createObjectURL(blob)
        anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `任务备份-${localDate(new Date())}.json`
        document.body.appendChild(anchor)
        anchor.click()
      } finally {
        try {
          anchor?.remove()
        } finally {
          if (url) URL.revokeObjectURL(url)
        }
      }
    },
    onSuccess: () => toast.success("任务备份已下载"),
    onError: (error) => toast.error(error instanceof Error ? `备份失败：${error.message}` : "备份失败，请重试。"),
  })

  function changeStatus(task: Task, action: "complete" | "reopen") {
    void runTaskWrite(() => statusMutation.mutateAsync({ task, action })).catch(() => undefined)
  }

  async function submitTask(input: TaskInput) {
    await runTaskWrite(() => saveMutation.mutateAsync({ id: editingTask?.id, input }))
  }

  const visibleTasks = filterTasks(orderedTasks, activeView)
  const activeViewConfig = views.find((view) => view.key === activeView) ?? views[0]
  const statusPendingId = statusMutation.isPending ? statusMutation.variables.task.id : null

  return (
    <section aria-labelledby="tasks-title" className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 id="tasks-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">任务管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">组织任务、明确下一步，通过拖拽调整执行顺序。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={isSaving} onClick={() => setQuickAddOpen(true)}><Zap aria-hidden="true" />快速新建</Button>
          <Button variant="outline" disabled={backupMutation.isPending} onClick={() => backupMutation.mutate()}><Download aria-hidden="true" />{backupMutation.isPending ? "正在备份…" : "备份任务"}</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" disabled={isSaving || orderedTasks.length === 0} onClick={() => setClearOpen(true)}><Trash2 aria-hidden="true" />清空全部任务</Button>
          <Button disabled={isSaving} onClick={openNewTask}><Plus aria-hidden="true" />新建任务</Button>
        </div>
      </header>

      {tasksQuery.isPending ? <TasksLoading /> : null}
      {tasksQuery.isError ? (
        <StatePanel
          status="error"
          title="任务加载失败"
          description={tasksQuery.error instanceof Error ? tasksQuery.error.message : "请稍后重试。"}
          onRetry={() => void tasksQuery.refetch()}
          className="min-h-72"
        />
      ) : null}

      {tasksQuery.data ? (
        <Card>
          <CardContent>
            <Tabs value={activeView} onValueChange={(value) => setActiveView(value as TaskView)}>
              <TabsList className="h-auto w-full justify-start overflow-x-auto" aria-label="任务视图">
                {views.map((view) => (
                  <TabsTrigger key={view.key} value={view.key} className="min-h-10 shrink-0 px-3">
                    {view.label}<span className="ml-1 rounded-full bg-background/70 px-1.5 text-xs">{filterTasks(orderedTasks, view.key).length}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {views.map((view) => (
                <TabsContent key={view.key} value={view.key} className="pt-5">
                  {view.key === activeView && visibleTasks.length > 0 ? (
                    <TaskList
                      tasks={visibleTasks}
                      focusedId={focusId}
                      isSaving={isSaving}
                      statusPendingId={statusPendingId}
                      onDragEnd={onDragEnd}
                      onEdit={(task) => { setEditingTask(task); setFormOpen(true) }}
                      onDelete={setDeletingTask}
                      onComplete={(task) => changeStatus(task, "complete")}
                      onReopen={(task) => changeStatus(task, "reopen")}
                    />
                  ) : null}
                  {view.key === activeView && visibleTasks.length === 0 ? (
                    <>
                      <StatePanel status="empty" title={activeViewConfig.emptyTitle} description={activeViewConfig.emptyDescription} />
                      <Button variant="outline" size="sm" className="mx-auto -mt-4 flex w-fit" disabled={isSaving} onClick={openNewTask}><Plus aria-hidden="true" />添加任务</Button>
                    </>
                  ) : null}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      ) : null}

      <TaskFormDrawer open={formOpen} task={editingTask} writePending={isSaving} onOpenChange={setFormOpen} onSubmit={submitTask} />
      <QuickAddDrawer open={quickAddOpen} writePending={isSaving} onOpenChange={setQuickAddOpen} onSubmit={async (input) => { await runTaskWrite(() => saveMutation.mutateAsync({ input })) }} />
      <ClearTasksDialog open={clearOpen} onOpenChange={setClearOpen} onConfirm={() => { void runTaskWrite(() => clearMutation.mutateAsync()).catch(() => undefined) }} />
      <ConfirmDialog
        open={deletingTask !== null}
        onOpenChange={(open) => { if (!open) setDeletingTask(null) }}
        title="删除任务？"
        description={deletingTask ? `将永久删除“${deletingTask.title}”，此操作无法撤销。` : "此操作无法撤销。"}
        cancelText="取消"
        actionText="删除任务"
        destructive
        onConfirm={() => { if (deletingTask) void runTaskWrite(() => deleteMutation.mutateAsync(deletingTask)).catch(() => undefined) }}
      />
    </section>
  )
}
