export interface ContentItem {
  title: string
  url: string
  source: string
  points: string[]
  action: string
}

export interface DailyContent {
  date: string
  articles: ContentItem[]
  videos: ContentItem[]
  notice: string
}
