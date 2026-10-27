import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { DragEndEvent } from "@dnd-kit/core"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"
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

function setup(tasks: Task[], reorder: (tasks: Task[]) => Promise<Task[]>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(["tasks", "list"], tasks)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const view = renderHook(() => useTaskOrder(tasks, reorder), { wrapper })
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
})
