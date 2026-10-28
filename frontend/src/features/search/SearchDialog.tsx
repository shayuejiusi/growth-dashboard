import { AlertCircle, FileText, Inbox, LoaderCircle, Search, SquareCheckBig, UserRound, type LucideIcon } from "lucide-react"
import { useEffect, useRef, useState, type RefObject } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { SearchResult } from "./search-api"
import { useGlobalSearch } from "./use-global-search"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef?: RefObject<HTMLButtonElement | null>
}

const resultTypes: Record<SearchResult["type"], { label: string; icon: LucideIcon; path: string; parameter: string }> = {
  task: { label: "任务", icon: SquareCheckBig, path: "/tasks", parameter: "focus" },
  person: { label: "人员", icon: UserRound, path: "/talent", parameter: "person" },
  content: { label: "内容", icon: FileText, path: "/content", parameter: "item" },
}

function safeResultPath(result: SearchResult) {
  if (typeof result.path !== "string" || !result.path.startsWith("/") || result.path.startsWith("//") || result.path.includes("#")) return null
  try {
    const url = new URL(result.path, window.location.origin)
    const resultType = resultTypes[result.type]
    if (url.origin !== window.location.origin || url.pathname !== resultType.path) return null
    const parameters = [...url.searchParams.entries()]
    const expectedValue = result.type === "content" ? result.title : result.id
    if (parameters.length !== 1) return null
    const [[name, value]] = parameters
    if (name !== resultType.parameter || !value.trim() || value !== expectedValue) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

export function SearchDialog({ open, onOpenChange, returnFocusRef }: SearchDialogProps) {
  const navigate = useNavigate()
  const shouldReturnFocus = useRef(true)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(-1)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const { trimmedQuery, validationMessage, isDebouncing, searchQuery } = useGlobalSearch(open, query)
  const [previousData, setPreviousData] = useState(searchQuery.data)
  const results = searchQuery.data
    ? [...searchQuery.data.tasks, ...searchQuery.data.people, ...searchQuery.data.content]
    : []
  const showResultList = Boolean(
    trimmedQuery && !validationMessage && !isDebouncing && !searchQuery.isLoading && !searchQuery.isError && results.length > 0,
  )

  if (previousData !== searchQuery.data) {
    setPreviousData(searchQuery.data)
    setActiveIndex(-1)
  }

  useEffect(() => {
    if (open) shouldReturnFocus.current = true
  }, [open])

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(`global-search-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery("")
      setActiveIndex(-1)
      setNavigationError(null)
    }
    onOpenChange(nextOpen)
  }

  function selectResult(result: SearchResult) {
    const path = safeResultPath(result)
    if (!path) {
      setNavigationError("无法打开该搜索结果：链接地址无效或不在允许范围内。")
      return
    }
    setNavigationError(null)
    shouldReturnFocus.current = false
    handleOpenChange(false)
    navigate(path)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (!results.length) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % results.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1))
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      selectResult(results[activeIndex])
    }
  }

  const groups = searchQuery.data ? [
    { key: "tasks", label: "任务", items: searchQuery.data.tasks },
    { key: "people", label: "人员", items: searchQuery.data.people },
    { key: "content", label: "内容", items: searchQuery.data.content },
  ] : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="top-[6vh] flex max-h-[88vh] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:top-[10vh] sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          if (!shouldReturnFocus.current) {
            event.preventDefault()
            return
          }
          if (!returnFocusRef) return
          event.preventDefault()
          returnFocusRef.current?.focus()
        }}
      >
        <DialogHeader className="shrink-0 border-b p-4 pr-12 text-left">
          <DialogTitle>全局搜索</DialogTitle>
          <DialogDescription>搜索你有权查看的任务、人员和内容，使用上下键选择，Enter 打开。</DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0 border-b p-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            type="search"
            role="combobox"
            aria-label="全局搜索"
            aria-autocomplete="list"
            aria-expanded={showResultList}
            aria-controls={showResultList ? "global-search-results" : undefined}
            aria-activedescendant={showResultList && activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(-1)
              setNavigationError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入关键词"
            className="h-11 pl-9 pr-3"
          />
        </div>
        <div className="min-h-48 overflow-y-auto p-2">
          {navigationError ? <p role="alert" className="px-3 py-2 text-sm text-destructive">{navigationError}</p> : null}
          {validationMessage ? (
            <p role="alert" className="p-6 text-center text-sm text-muted-foreground">{validationMessage}</p>
          ) : !trimmedQuery ? (
            <div role="status" className="flex min-h-44 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <Search className="size-6" aria-hidden="true" />
              <p className="text-sm">输入关键词开始搜索</p>
            </div>
          ) : isDebouncing ? (
            <p role="status" className="p-6 text-center text-sm text-muted-foreground">等待输入完成…</p>
          ) : searchQuery.isLoading ? (
            <div role="status" className="flex min-h-44 items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />正在搜索…
            </div>
          ) : searchQuery.isError ? (
            <div role="alert" className="flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
              <p className="text-sm text-destructive">{searchQuery.error instanceof Error ? searchQuery.error.message : "搜索失败，请稍后重试。"}</p>
              <Button variant="outline" size="sm" onClick={() => void searchQuery.refetch()}>重试搜索</Button>
            </div>
          ) : results.length === 0 ? (
            <div role="status" className="flex min-h-44 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <Inbox className="size-6" aria-hidden="true" />
              <p className="text-sm">未找到匹配内容</p>
            </div>
          ) : (
            <div id="global-search-results" role="listbox" aria-label="搜索结果">
              {groups.map((group, groupIndex) => {
                if (!group.items.length) return null
                const offset = groups.slice(0, groupIndex).reduce((total, item) => total + item.items.length, 0)
                return (
                  <section key={group.key} role="group" aria-labelledby={`global-search-group-${group.key}`}>
                    <h2 id={`global-search-group-${group.key}`} className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">{group.label}</h2>
                    {group.items.map((result, itemIndex) => {
                      const index = offset + itemIndex
                      const Icon = resultTypes[result.type].icon
                      const active = index === activeIndex
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          id={`global-search-option-${index}`}
                          type="button"
                          role="option"
                          tabIndex={-1}
                          aria-selected={active}
                          className={cn(
                            "flex w-full min-w-0 items-start gap-3 rounded-md px-3 py-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                            active && "bg-accent text-accent-foreground",
                          )}
                          onMouseMove={() => setActiveIndex(index)}
                          onFocus={() => setActiveIndex(index)}
                          onClick={() => selectResult(result)}
                        >
                          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-medium">{result.title}</span>
                            <span className="mt-0.5 block break-words text-xs text-muted-foreground">{result.subtitle}</span>
                          </span>
                        </button>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          )}
        </div>
        <div className="hidden shrink-0 border-t px-4 py-2 text-xs text-muted-foreground sm:block" aria-hidden="true">
          ↑↓ 选择 · Enter 打开 · Esc 关闭
        </div>
      </DialogContent>
    </Dialog>
  )
}
