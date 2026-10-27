import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { DragEndEvent } from "@dnd-kit/core"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"
import type { TaskWriteCoordinator } from "./task-write-coordinator"
import type { Task } from "./types"
import { useTaskOrder } from "./use-task-order"

function makeTask(id: string, position: number, version = 0): Task {
  return {
    id,
    title: `任务 ${id}`,
    priority: "P2",
    dueDate: null,
    status: "TODO",
    needReport: false,
    note: null,
    category: null,
    source: null,
    nextStep: null,
    expectedOutcome: null,
    blocker: null,
    repeatType: "NONE",
    position,
    version,
  }
}

function dragEvent(active: string, over: string): DragEndEvent {
  return { active: { id: active }, over: { id: over } } as DragEndEvent
}

interface SetupOptions {
  coordinator?: TaskWriteCoordinator
  queryFn?: () => Promise<Task[]>
  queryClient?: QueryClient
}

function setup(tasks: Task[], reorder: (tasks: Task[]) => Promise<Task[]>, options: SetupOptions = {}) {
  const queryClient = options.queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(["tasks", "list"], tasks)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const view = renderHook(() => {
    useQuery({
      queryKey: ["tasks", "list"],
      queryFn: options.queryFn ?? (() => Promise.resolve(tasks)),
      initialData: tasks,
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    })
    return useTaskOrder(tasks, reorder, options.coordinator)
  }, { wrapper })
  return { queryClient, ...view }
}

describe("任务拖拽排序", () => {
  afterEach(() => {
    toast.dismiss()
    vi.restoreAllMocks()
  })

  it("提交全量 ID 和当前版本，并采用服务端返回的顺序与版本", async () => {
    const a = makeTask("a", 0, 3)
    const b = makeTask("b", 1, 5)
    const saved = [
      { ...b, position: 0, version: 6 },
      { ...a, position: 1, version: 4 },
    ]
    const reorder = vi.fn().mockResolvedValue(saved)
    const { result, queryClient } = setup([a, b], reorder)

    await act(() => result.current.onDragEnd(dragEvent(a.id, b.id)))

    expect(reorder.mock.calls[0][0]).toEqual([b, a])
    expect(result.current.orderedTasks.map((task) => task.id)).toEqual([b.id, a.id])
    expect(result.current.orderedTasks.map((task) => task.version)).toEqual([6, 4])
    expect(queryClient.getQueryData(["tasks", "list"])).toEqual(saved)
    expect(result.current.isSaving).toBe(false)
  })

  it("排序失败时回滚并显示稳定错误反馈", async () => {
    const a = makeTask("a", 0)
    const b = makeTask("b", 1)
    const reorder = vi.fn().mockRejectedValueOnce(new ApiError(500, "网络失败"))
    const error = vi.spyOn(toast, "error").mockImplementation(() => "")
    const { result, queryClient } = setup([a, b], reorder)

    await act(() => result.current.onDragEnd(dragEvent(a.id, b.id)))

    expect(result.current.orderedTasks.map((task) => task.id)).toEqual([a.id, b.id])
    expect(queryClient.getQueryData(["tasks", "list"])).toEqual([a, b])
    expect(error).toHaveBeenCalledWith("排序未保存，已恢复原顺序")
  })

  it("409 冲突回滚后重新拉取任务", async () => {
    const a = makeTask("a", 0)
    const b = makeTask("b", 1)
    const reorder = vi.fn().mockRejectedValueOnce(new ApiError(409, "任务已被其他操作更新", { code: "TASK_ORDER_CONFLICT" }))
    vi.spyOn(toast, "error").mockImplementation(() => "")
    const { result, queryClient } = setup([a, b], reorder)
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    await act(() => result.current.onDragEnd(dragEvent(a.id, b.id)))

    expect(result.current.orderedTasks.map((task) => task.id)).toEqual([a.id, b.id])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks"] })
  })

  it("筛选视图移动后将可见项插回全量顺序，隐藏项保持原位", async () => {
    const a = makeTask("a", 0)
    const hidden = makeTask("hidden", 1)
    const b = makeTask("b", 2)
    const c = makeTask("c", 3)
    const reorder = vi.fn().mockImplementation(async (tasks: Task[]) => tasks)
    const { result } = setup([a, hidden, b, c], reorder)

    await act(() => result.current.onDragEnd(dragEvent(c.id, a.id), [a, b, c]))

    expect(reorder.mock.calls[0][0]).toEqual([c, hidden, a, b])
    expect(result.current.orderedTasks.map((task) => task.id)).toEqual([c.id, hidden.id, a.id, b.id])
  })

  it("保存期间忽略同一列表的再次提交", async () => {
    const a = makeTask("a", 0)
    const b = makeTask("b", 1)
    const c = makeTask("c", 2)
    let finish!: (tasks: Task[]) => void
    const reorder = vi.fn().mockImplementation(() => new Promise<Task[]>((resolve) => { finish = resolve }))
    const { result } = setup([a, b, c], reorder)

    let saving!: Promise<void>
    act(() => {
      saving = result.current.onDragEnd(dragEvent(a.id, c.id))
    })
    await waitFor(() => expect(result.current.isSaving).toBe(true))
    await act(() => result.current.onDragEnd(dragEvent(b.id, c.id)))
    expect(reorder).toHaveBeenCalledTimes(1)

    await act(async () => {
      finish([c, b, a])
      await saving
    })
    expect(result.current.isSaving).toBe(false)
  })

  it("其他任务写操作持锁时，底层同步拒绝排序且不发请求", async () => {
    const a = makeTask("a", 0)
    const b = makeTask("b", 1)
    const reorder = vi.fn().mockResolvedValue([b, a])
    const coordinator: TaskWriteCoordinator = {
      tryAcquire: vi.fn(() => false),
      release: vi.fn(),
      getSnapshot: () => true,
      subscribe: () => () => undefined,
    }
    const { result } = setup([a, b], reorder, { coordinator })

    await act(() => result.current.onDragEnd(dragEvent(a.id, b.id)))

    expect(reorder).not.toHaveBeenCalled()
    expect(coordinator.release).not.toHaveBeenCalled()
  })

  it("409 后等待活动查询返回最新顺序和版本再解锁", async () => {
    const a = makeTask("a", 0, 1)
    const b = makeTask("b", 1, 1)
    const latest = [
      { ...a, title: "服务端最新 a", version: 8 },
      { ...b, title: "服务端最新 b", version: 9 },
    ]
    let finishRefetch!: (tasks: Task[]) => void
    const queryFn = vi.fn(() => new Promise<Task[]>((resolve) => { finishRefetch = resolve }))
    const reorder = vi.fn().mockRejectedValue(new ApiError(409, "版本冲突", { code: "TASK_ORDER_CONFLICT" }))
    vi.spyOn(toast, "error").mockImplementation(() => "")
    const { result } = setup([a, b], reorder, { queryFn })

    let saving!: Promise<void>
    act(() => { saving = result.current.onDragEnd(dragEvent(a.id, b.id)) })
    await waitFor(() => expect(queryFn).toHaveBeenCalled())
    expect(result.current.isSaving).toBe(true)
    await act(() => result.current.onDragEnd(dragEvent(a.id, b.id)))
    expect(reorder).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishRefetch(latest)
      await saving
    })
    expect(result.current.orderedTasks).toEqual(latest)
    expect(result.current.isSaving).toBe(false)
  })

  it("409 刷新失败时结束锁定并给出可重试错误状态", async () => {
    const a = makeTask("a", 0)
    const b = makeTask("b", 1)
    const reorder = vi.fn().mockRejectedValue(new ApiError(409, "版本冲突", { code: "TASK_ORDER_CONFLICT" }))
    const error = vi.spyOn(toast, "error").mockImplementation(() => "")
    const { result, queryClient } = setup([a, b], reorder, { queryFn: () => Promise.reject(new Error("刷新失败")) })

    await act(() => result.current.onDragEnd(dragEvent(a.id, b.id)))

    expect(result.current.isSaving).toBe(false)
    expect(queryClient.getQueryState(["tasks", "list"])?.status).toBe("error")
    expect(error).toHaveBeenCalledWith("最新任务顺序加载失败，请重新加载后重试")
  })

  it("pending 卸载会撤销乐观缓存，重新挂载不显示未确认顺序", async () => {
    const a = makeTask("a", 0)
    const b = makeTask("b", 1)
    let finish!: (tasks: Task[]) => void
    const reorder = vi.fn(() => new Promise<Task[]>((resolve) => { finish = resolve }))
    const first = setup([a, b], reorder)

    let saving!: Promise<void>
    act(() => { saving = first.result.current.onDragEnd(dragEvent(a.id, b.id)) })
    await waitFor(() => {
      expect(first.queryClient.getQueryData<Task[]>(["tasks", "list"])?.map((task) => task.id)).toEqual([b.id, a.id])
    })
    first.unmount()

    expect(first.queryClient.getQueryData<Task[]>(["tasks", "list"])?.map((task) => task.id)).toEqual([a.id, b.id])
    const second = setup([a, b], reorder, { queryClient: first.queryClient })
    expect(second.result.current.orderedTasks.map((task) => task.id)).toEqual([a.id, b.id])

    await act(async () => {
      finish([b, a])
      await saving
    })
    expect(first.queryClient.getQueryData<Task[]>(["tasks", "list"])?.map((task) => task.id)).toEqual([b.id, a.id])
  })

  it("延迟排序失败不会用 previous 覆盖更新的缓存", async () => {
    const a = makeTask("a", 0)
    const b = makeTask("b", 1)
    let fail!: (error: Error) => void
    const reorder = vi.fn(() => new Promise<Task[]>((_resolve, reject) => { fail = reject }))
    vi.spyOn(toast, "error").mockImplementation(() => "")
    const { result, queryClient } = setup([a, b], reorder)

    let saving!: Promise<void>
    act(() => { saving = result.current.onDragEnd(dragEvent(a.id, b.id)) })
    await waitFor(() => expect(result.current.isSaving).toBe(true))
    const newer = [{ ...a, title: "较新的编辑", version: 7 }, b]
    queryClient.setQueryData(["tasks", "list"], newer)
    await act(async () => {
      fail(new ApiError(500, "排序失败"))
      await saving
    })

    expect(queryClient.getQueryData(["tasks", "list"])).toEqual(newer)
  })
})
