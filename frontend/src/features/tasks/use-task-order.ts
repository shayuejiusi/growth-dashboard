import { arrayMove } from "@dnd-kit/sortable"
import type { DragEndEvent } from "@dnd-kit/core"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ApiError } from "@/lib/api/errors"
import { getTaskWriteCoordinator, useTaskWriteLocked, type TaskWriteCoordinator } from "./task-write-coordinator"
import { reorderTasks, taskKeys } from "./tasks-api"
import type { Task } from "./types"

type Reorder = (tasks: Task[]) => Promise<Task[]>

interface OrderOperation {
  previous: Task[]
  optimistic: Task[]
}

// TanStack Query 的结构共享可能为相同任务序列创建新数组或对象，需比较任务快照内容。
function isSameSnapshot(current: Task[] | undefined, snapshot: Task[]) {
  return current !== undefined && JSON.stringify(current) === JSON.stringify(snapshot)
}

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

export function useTaskOrder(tasks: Task[], reorder: Reorder = reorderTasks, providedCoordinator?: TaskWriteCoordinator) {
  const queryClient = useQueryClient()
  const coordinator = providedCoordinator ?? getTaskWriteCoordinator(queryClient)
  const isSaving = useTaskWriteLocked(coordinator)
  const [orderedTasks, setOrderedTasks] = useState(tasks)
  const orderedRef = useRef(orderedTasks)
  const mountedRef = useRef(false)
  const operationRef = useRef<OrderOperation | null>(null)

  function applyOrder(next: Task[]) {
    orderedRef.current = next
    if (mountedRef.current) setOrderedTasks(next)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const operation = operationRef.current
      if (!operation) return
      // 组件回调不再负责请求收尾；卸载先撤销未确认缓存，再让查询重新校验。
      const current = queryClient.getQueryData<Task[]>(taskKeys.list())
      if (isSameSnapshot(current, operation.optimistic)) {
        queryClient.setQueryData(taskKeys.list(), operation.previous)
      }
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
    }
  }, [queryClient])

  useEffect(() => {
    if (!operationRef.current) applyOrder(tasks)
  }, [tasks])

  async function onDragEnd(event: DragEndEvent, visibleTasks = orderedRef.current): Promise<void> {
    if (!coordinator.tryAcquire("order")) {
      toast.info("另一项任务操作正在保存，请稍后重试")
      return
    }

    try {
      const next = mergeVisibleOrder(orderedRef.current, visibleTasks, event)
      if (!next) return

      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const previous = queryClient.getQueryData<Task[]>(taskKeys.list()) ?? orderedRef.current
      const operation = { previous, optimistic: next }
      operationRef.current = operation
      applyOrder(next)
      queryClient.setQueryData(taskKeys.list(), next)

      try {
        const saved = await reorder(next)
        const current = queryClient.getQueryData<Task[]>(taskKeys.list())
        // 只有缓存仍是本次乐观值或卸载时恢复的前值，才采用本次响应。
        if (current === undefined || isSameSnapshot(current, operation.optimistic) || isSameSnapshot(current, operation.previous)) {
          queryClient.setQueryData(taskKeys.list(), saved)
          applyOrder(saved)
        } else {
          applyOrder(current)
        }
      } catch (error) {
        const current = queryClient.getQueryData<Task[]>(taskKeys.list())
        if (current === undefined || isSameSnapshot(current, operation.optimistic) || isSameSnapshot(current, operation.previous)) {
          queryClient.setQueryData(taskKeys.list(), previous)
          applyOrder(previous)
        } else {
          // 不用过期 previous 覆盖查询或其他新状态。
          applyOrder(current)
        }
        toast.error("排序未保存，已恢复原顺序")

        if (error instanceof ApiError && (error.status === 409 || error.code === "TASK_ORDER_CONFLICT")) {
          try {
            // 保持写锁直到活动 tasks 查询完成，避免基于旧版本立即再次排序。
            await queryClient.invalidateQueries({ queryKey: taskKeys.all })
          } catch {
            // QueryClient 默认在 query state 中记录失败；下方统一提供重试反馈。
          }
          const latest = queryClient.getQueryData<Task[]>(taskKeys.list())
          if (latest) applyOrder(latest)
          if (queryClient.getQueryState(taskKeys.list())?.status === "error") {
            toast.error("最新任务顺序加载失败，请重新加载后重试")
          }
        }
      } finally {
        operationRef.current = null
      }
    } catch {
      toast.error("排序未保存，已恢复原顺序")
    } finally {
      coordinator.release("order")
    }
  }

  return { orderedTasks, onDragEnd, isSaving }
}
