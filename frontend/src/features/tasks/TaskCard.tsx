import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CalendarDays, Check, GripVertical, Pencil, RotateCcw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Task } from "./types"

interface TaskCardProps {
  task: Task
  focused: boolean
  savingOrder: boolean
  statusPending: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onComplete: (task: Task) => void
  onReopen: (task: Task) => void
}

const priorityVariant = { P0: "destructive", P1: "default", P2: "secondary" } as const
const repeatLabels = { DAILY: "每日", WEEKLY: "每周", NONE: "" }

export function TaskCard({ task, focused, savingOrder, statusPending, onEdit, onDelete, onComplete, onReopen }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: savingOrder })
  const done = task.status === "DONE"

  return (
    <article
      ref={setNodeRef}
      id={`task-${task.id}`}
      data-testid={`task-${task.id}`}
      data-focused={focused ? "true" : "false"}
      tabIndex={-1}
      aria-label={task.title}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm outline-none transition-[box-shadow,border-color]",
        isDragging && "z-10 opacity-80 shadow-lg",
        focused && "border-primary ring-2 ring-primary/30",
        done && "bg-muted/40",
      )}
    >
      <div className="flex items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-2 min-h-11 min-w-11 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label={`拖动“${task.title}”排序`}
          disabled={savingOrder}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
            <h3 className={cn("min-w-0 break-words font-medium", done && "text-muted-foreground line-through")}>{task.title}</h3>
            {task.repeatType && task.repeatType !== "NONE" ? <Badge variant="outline">{repeatLabels[task.repeatType]}</Badge> : null}
            {task.needReport ? <Badge variant="outline">需汇报</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              {task.dueDate ? <time dateTime={task.dueDate}>截止 {task.dueDate}</time> : "未设置截止日期"}
            </span>
            {task.category ? <span>{task.category}</span> : null}
            {task.source ? <span>来源：{task.source}</span> : null}
          </div>
          {task.nextStep ? <p className="text-sm"><span className="text-muted-foreground">下一步：</span>{task.nextStep}</p> : null}
          {task.blocker ? <p className="text-sm text-destructive">阻塞：{task.blocker}</p> : null}
          {task.note ? <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{task.note}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="ghost" size="sm" className="min-h-9" disabled={savingOrder} onClick={() => onEdit(task)}><Pencil aria-hidden="true" />编辑<span className="sr-only">“{task.title}”</span></Button>
        {done ? (
          <Button variant="outline" size="sm" className="min-h-9" disabled={savingOrder || statusPending} onClick={() => onReopen(task)} aria-label={`重开“${task.title}”`}><RotateCcw aria-hidden="true" />重开</Button>
        ) : (
          <Button variant="outline" size="sm" className="min-h-9" disabled={savingOrder || statusPending} onClick={() => onComplete(task)} aria-label={`完成“${task.title}”`}><Check aria-hidden="true" />完成</Button>
        )}
        <Button variant="ghost" size="sm" className="min-h-9 text-destructive hover:text-destructive" disabled={savingOrder} onClick={() => onDelete(task)} aria-label={`删除“${task.title}”`}><Trash2 aria-hidden="true" />删除</Button>
      </div>
    </article>
  )
}
