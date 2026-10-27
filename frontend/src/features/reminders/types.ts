import type { TaskItem, TaskStats } from "@/features/dashboard/types"

export type ReminderGroup = "todayDue" | "overdue" | "highPriority" | "needReport" | "recurring"

export interface ReminderScript {
  scene: string
  text: string
}

export interface RemindersData {
  generatedAt: string
  phase: string
  stats: TaskStats
  reminders: Record<ReminderGroup, TaskItem[]>
  scripts: ReminderScript[]
  focusNow: string
}
