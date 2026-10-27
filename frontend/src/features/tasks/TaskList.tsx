import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { TaskCard } from "./TaskCard"
import type { Task } from "./types"

interface TaskListProps {
  tasks: Task[]
  focusedId: string | null
  isSaving: boolean
  statusPendingId: string | null
  onDragEnd: (event: DragEndEvent, visibleTasks: Task[]) => Promise<void>
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onComplete: (task: Task) => void
  onReopen: (task: Task) => void
}

function taskTitle(tasks: Task[], id: UniqueIdentifier | undefined) {
  return tasks.find((task) => task.id === id)?.title ?? "任务"
}

export function TaskList({ tasks, focusedId, isSaving, statusPendingId, onDragEnd, ...actions }: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => { void onDragEnd(event, tasks) }}
      accessibility={{
        screenReaderInstructions: {
          draggable: "按空格键拾取任务，使用方向键移动，再按空格键放下；按 Escape 取消。",
        },
        announcements: {
          onDragStart({ active }) { return `已拾取${taskTitle(tasks, active?.id)}` },
          onDragOver({ active, over }) { return over ? `${taskTitle(tasks, active?.id)}已移动到${taskTitle(tasks, over?.id)}的位置` : undefined },
          onDragEnd({ active, over }) { return over ? `${taskTitle(tasks, active?.id)}已放到${taskTitle(tasks, over?.id)}的位置` : "排序已取消" },
          onDragCancel({ active }) { return `已取消移动${taskTitle(tasks, active?.id)}` },
        },
      }}
    >
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3" aria-busy={isSaving}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              focused={focusedId === task.id}
              savingOrder={isSaving}
              statusPending={statusPendingId === task.id}
              {...actions}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
