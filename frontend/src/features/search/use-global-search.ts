import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { searchGlobal } from "./search-api"

export function useGlobalSearch(open: boolean, query: string) {
  const queryClient = useQueryClient()
  const trimmedQuery = query.trim()
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(trimmedQuery), 300)
    return () => window.clearTimeout(timer)
  }, [trimmedQuery])

  useEffect(() => () => {
    void queryClient.cancelQueries({ queryKey: ["search"] })
  }, [open, queryClient, trimmedQuery])

  const isDebouncing = trimmedQuery !== debouncedQuery
  const validDebouncedQuery = debouncedQuery.length >= 1 && debouncedQuery.length <= 50
  const searchQuery = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: ({ signal }) => searchGlobal(debouncedQuery, signal),
    enabled: open && !isDebouncing && validDebouncedQuery,
    retry: false,
    staleTime: 30_000,
  })

  const validationMessage = trimmedQuery.length > 50
    ? "关键词最多 50 个字符"
    : query.length > 0 && trimmedQuery.length === 0
      ? "请输入至少 1 个非空白字符"
      : null

  return { trimmedQuery, validationMessage, isDebouncing, searchQuery }
}
