import { api } from "@/lib/api/client"

export interface SearchResult {
  type: "task" | "person" | "content"
  id: string
  title: string
  subtitle: string
  path: string
}

export interface SearchResponse {
  tasks: SearchResult[]
  people: SearchResult[]
  content: SearchResult[]
}

export function searchGlobal(query: string, signal?: AbortSignal) {
  return api<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`, { signal })
}
