export type TaskPriority = "P0" | "P1" | "P2"
export type TaskStatus = "TODO" | "DOING" | "DONE"
export type RepeatType = "NONE" | "DAILY" | "WEEKLY"

export interface TaskItem {
  id: string
  title: string
  priority: TaskPriority
  dueDate: string | null
  status: TaskStatus
  needReport: boolean
  note: string | null
  category: string | null
  source: string | null
  nextStep: string | null
  expectedOutcome: string | null
  blocker: string | null
  repeatType: RepeatType | null
  position: number | null
  version: number | null
}

export interface TaskStats {
  total: number
  open: number
  overdue: number
  highPriority: number
  todayDue: number
  completedTotal: number
  completionRate: number
  needReport: number
}

export interface DashboardData {
  generatedAt: string
  stats: TaskStats
  top3: TaskItem[]
  focusNow: string
}

export interface AiStatus {
  remoteConfigured: boolean
  provider: string
  hint: string
}
