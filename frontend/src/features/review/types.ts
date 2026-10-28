export interface ReviewDraft {
  date: string
  metrics: Record<string, string | number>
  overdueAnalysis: string
  reportQuality: string
  collabIssues: string
  highlights: string[]
  improvements: string[]
  tomorrowGoals: string[]
}
