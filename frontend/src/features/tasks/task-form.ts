import { z } from "zod"

import type { Task, TaskInput } from "./types"

const optionalText = (max: number) => z.string().max(max, `最多输入 ${max} 个字符`)

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "请输入任务标题").max(255, "任务标题最多 255 个字符"),
  priority: z.enum(["P0", "P1", "P2"]),
  dueDate: z.union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD"),
  ]),
  needReport: z.boolean(),
  note: optionalText(2000),
  category: optionalText(50),
  source: optionalText(200),
  nextStep: optionalText(500),
  expectedOutcome: optionalText(500),
  blocker: optionalText(500),
  repeatType: z.enum(["NONE", "DAILY", "WEEKLY"]),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

export const emptyTaskForm: TaskFormValues = {
  title: "",
  priority: "P2",
  dueDate: "",
  needReport: false,
  note: "",
  category: "",
  source: "",
  nextStep: "",
  expectedOutcome: "",
  blocker: "",
  repeatType: "NONE",
}

export function taskToFormValues(task: Task): TaskFormValues {
  return {
    title: task.title,
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    needReport: task.needReport,
    note: task.note ?? "",
    category: task.category ?? "",
    source: task.source ?? "",
    nextStep: task.nextStep ?? "",
    expectedOutcome: task.expectedOutcome ?? "",
    blocker: task.blocker ?? "",
    repeatType: task.repeatType ?? "NONE",
  }
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function toTaskInput(values: TaskFormValues): TaskInput {
  return {
    title: values.title.trim(),
    priority: values.priority,
    dueDate: values.dueDate || null,
    needReport: values.needReport,
    note: nullable(values.note),
    category: nullable(values.category),
    source: nullable(values.source),
    nextStep: nullable(values.nextStep),
    expectedOutcome: nullable(values.expectedOutcome),
    blocker: nullable(values.blocker),
    repeatType: values.repeatType,
  }
}
