import type { RepeatType, TaskItem, TaskPriority, TaskStatus } from "@/features/dashboard/types"

export type { RepeatType, TaskPriority, TaskStatus }

export interface Task extends TaskItem {
  createdAt?: string | null
  completedAt?: string | null
}

export interface TaskInput {
  title: string
  priority: TaskPriority
  dueDate: string | null
  needReport: boolean
  note: string | null
  category: string | null
  source: string | null
  nextStep: string | null
  expectedOutcome: string | null
  blocker: string | null
  repeatType: RepeatType
}

export type TaskView = "today" | "daily" | "weekly" | "week" | "overdue" | "high" | "report" | "done" | "all"
