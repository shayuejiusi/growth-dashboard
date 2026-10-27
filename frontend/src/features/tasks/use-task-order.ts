import { arrayMove } from "@dnd-kit/sortable"
import type { DragEndEvent } from "@dnd-kit/core"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ApiError } from "@/lib/api/errors"
import { reorderTasks } from "./tasks-api"
import { taskKeys } from "./tasks-api"
import type { Task } from "./types"

type Reorder = (tasks: Task[]) => Promise<Task[]>

function mergeVisibleOrder(allTasks: Task[], visibleTasks: Task[], event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return null
  const oldIndex = visibleTasks.findIndex((task) => task.id === active.id)
  const newIndex = visibleTasks.findIndex((task) => task.id === over.id)
  if (oldIndex < 0 || newIndex < 0) return null

  const movedVisible = arrayMove(visibleTasks, oldIndex, newIndex)
  const visibleIds = new Set(visibleTasks.map((task) => task.id))
  let visibleIndex = 0
  return allTasks.map((task) => visibleIds.has(task.id) ? movedVisible[visibleIndex++] : task)
}

export function useTaskOrder(tasks: Task[], reorder: Reorder = reorderTasks) {
  const queryClient = useQueryClient()
  const [orderedTasks, setOrderedTasks] = useState(tasks)
  const orderedRef = useRef(orderedTasks)
  const savingRef = useRef(false)

  function applyOrder(next: Task[]) {
    orderedRef.current = next
    setOrderedTasks(next)
  }

  useEffect(() => {
    if (!savingRef.current) applyOrder(tasks)
  }, [tasks])

  const mutation = useMutation({
    mutationFn: reorder,
    onMutate: async (next: Task[]) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const previous = queryClient.getQueryData<Task[]>(taskKeys.list()) ?? orderedRef.current
      applyOrder(next)
      queryClient.setQueryData(taskKeys.list(), next)
      return { previous }
    },
    onError: (error, _next, context) => {
      applyOrder(context?.previous ?? tasks)
      queryClient.setQueryData(taskKeys.list(), context?.previous ?? tasks)
      toast.error("排序未保存，已恢复原顺序")
      if (error instanceof ApiError && (error.status === 409 || error.code === "TASK_ORDER_CONFLICT")) {
        void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      }
    },
    onSuccess: (saved) => {
      applyOrder(saved)
      queryClient.setQueryData(taskKeys.list(), saved)
    },
  })

  async function onDragEnd(event: DragEndEvent, visibleTasks = orderedRef.current): Promise<void> {
    if (savingRef.current) return
    const next = mergeVisibleOrder(orderedRef.current, visibleTasks, event)
    if (!next) return

    savingRef.current = true
    try {
      await mutation.mutateAsync(next)
    } catch {
      // 回滚、用户反馈和冲突刷新统一由 mutation 的 onError 处理。
    } finally {
      savingRef.current = false
    }
  }

  return { orderedTasks, onDragEnd, isSaving: mutation.isPending }
}
