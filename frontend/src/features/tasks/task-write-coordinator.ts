import type { QueryClient } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

export type TaskWriteKind = "order" | "mutation"

export interface TaskWriteCoordinator {
  /** 同步获取唯一写锁；请求开始前的 await 不会留下竞争窗口。 */
  tryAcquire: (kind: TaskWriteKind) => boolean
  release: (kind: TaskWriteKind) => void
  getSnapshot: () => boolean
  subscribe: (listener: () => void) => () => void
}

const coordinators = new WeakMap<QueryClient, TaskWriteCoordinator>()

export function createTaskWriteCoordinator(): TaskWriteCoordinator {
  let owner: TaskWriteKind | null = null
  const listeners = new Set<() => void>()

  function notify() {
    listeners.forEach((listener) => listener())
  }

  return {
    tryAcquire(kind) {
      if (owner !== null) return false
      owner = kind
      notify()
      return true
    },
    release(kind) {
      if (owner !== kind) return
      owner = null
      notify()
    },
    getSnapshot() {
      return owner !== null
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** 同一 QueryClient 下的排序、CRUD 和状态操作共享一把锁，跨卸载/重挂载仍有效。 */
export function getTaskWriteCoordinator(queryClient: QueryClient) {
  let coordinator = coordinators.get(queryClient)
  if (!coordinator) {
    coordinator = createTaskWriteCoordinator()
    coordinators.set(queryClient, coordinator)
  }
  return coordinator
}

export function useTaskWriteLocked(coordinator: TaskWriteCoordinator) {
  return useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, coordinator.getSnapshot)
}
