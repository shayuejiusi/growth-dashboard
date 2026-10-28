import { useQuery } from "@tanstack/react-query"
import { BookOpen, ExternalLink, Play, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation, useSearchParams } from "react-router"

import { StatePanel } from "@/components/feedback/StatePanel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { contentKeys, getDailyContent } from "./content-api"
import type { ContentItem } from "./types"

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    return null
  }
}

function ContentCard({ item, target = false }: { item: ContentItem; target?: boolean }) {
  const url = safeExternalUrl(item.url)
  return (
    <Card
      id={target ? "content-search-target" : undefined}
      data-testid={target ? "content-search-target" : undefined}
      tabIndex={target ? -1 : undefined}
      className={target ? "ring-2 ring-primary ring-offset-2 outline-none" : undefined}
    >
      <CardHeader>
        <CardTitle className="text-base leading-6">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 underline-offset-4 hover:text-primary hover:underline">
              {item.title}<ExternalLink className="mt-1 size-4 shrink-0" aria-hidden="true" />
            </a>
          ) : <span>{item.title}</span>}
        </CardTitle>
        <CardDescription>
          <span>{item.source}</span>
          {!url ? <span className="ml-2 text-destructive">链接不可用</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {item.points.length ? <ul className="list-disc space-y-1 pl-5">{item.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
        {item.action ? <p className="rounded-md bg-primary/5 p-3 text-foreground"><span className="font-medium">行动建议：</span>{item.action}</p> : null}
      </CardContent>
    </Card>
  )
}

function ContentSection({ title, items, kind, targetItem }: { title: string; items: ContentItem[]; kind: "article" | "video"; targetItem?: ContentItem }) {
  const Icon = kind === "article" ? BookOpen : Play
  return (
    <section aria-labelledby={`content-${kind}`} className="space-y-4">
      <h2 id={`content-${kind}`} className="flex items-center gap-2 text-lg font-semibold"><Icon className="size-5 text-primary" aria-hidden="true" />{title}</h2>
      {items.length ? <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => <ContentCard key={`${item.title}-${item.url}`} item={item} target={item === targetItem} />)}</div> : (
        <StatePanel status="empty" title={`暂无${title}`} className="min-h-32 rounded-lg border" />
      )}
    </section>
  )
}

export function ContentPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const itemTitle = searchParams.get("item")
  const itemRequestKey = itemTitle ? location.key : null
  const [locationError, setLocationError] = useState<string | null>(null)
  const [handledItemRequest, setHandledItemRequest] = useState<string | null>(null)
  const dailyQuery = useQuery({ queryKey: contentKeys.daily(), queryFn: ({ signal }) => getDailyContent(signal) })
  const content = dailyQuery.data
  const targetItem = content && itemTitle
    ? [...content.articles, ...content.videos].find((item) => item.title === itemTitle)
    : undefined
  const empty = content === null || (content !== undefined && content.articles.length === 0 && content.videos.length === 0)

  if (itemRequestKey && itemRequestKey !== handledItemRequest && content) {
    setHandledItemRequest(itemRequestKey)
    setLocationError(targetItem ? null : "未找到该精选内容，可能已更新或删除。可继续浏览或重新搜索。")
  }
  if (!itemRequestKey && locationError) setLocationError(null)

  useEffect(() => {
    document.title = "每日精选 · 个人工作看板"
  }, [])

  useEffect(() => {
    if (!itemRequestKey || !targetItem) return
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById("content-search-target")
      card?.scrollIntoView({ block: "center", behavior: "smooth" })
      card?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [itemRequestKey, targetItem])

  return (
    <section aria-labelledby="content-title" className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="content-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">每日精选</h1>
          <p className="mt-2 text-sm text-muted-foreground">浏览现有精选文章与视频，把有价值的观点转化为行动。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={dailyQuery.isRefetching} onClick={() => void dailyQuery.refetch()}>
            <RefreshCw className={dailyQuery.isRefetching ? "animate-spin" : undefined} aria-hidden="true" />
            {dailyQuery.isRefetching ? "正在刷新" : "刷新内容"}
          </Button>
          <Button disabled title="AI 提示词和 API 暂未配置">AI 换一批（暂未配置）</Button>
        </div>
      </header>

      <div className="rounded-lg border bg-card px-4 py-3 text-sm">
        <p className="font-medium">AI 换一批暂未配置</p>
        <p className="mt-1 text-muted-foreground">AI 提示词和 API 暂未配置，不会请求生成新精选；当前内容来自已有每日精选。</p>
      </div>

      {locationError ? <Alert variant="destructive"><AlertTitle>无法定位精选内容</AlertTitle><AlertDescription>{locationError}</AlertDescription></Alert> : null}
      {dailyQuery.isPending ? <StatePanel status="loading" title="正在加载每日精选" className="min-h-72" /> : null}
      {dailyQuery.isError && !content ? (
        <StatePanel status="error" title="每日精选加载失败" description={dailyQuery.error instanceof Error ? dailyQuery.error.message : "请稍后重试。"} onRetry={() => void dailyQuery.refetch()} className="min-h-72" />
      ) : null}
      {dailyQuery.isError && content ? (
        <Alert variant="destructive"><AlertTitle>内容刷新失败</AlertTitle><AlertDescription>{dailyQuery.error instanceof Error ? dailyQuery.error.message : "请稍后重试。"} 已保留上次加载的内容。</AlertDescription></Alert>
      ) : null}
      {empty ? <StatePanel status="empty" title="暂无每日精选" description="当前没有可展示的文章或视频，可稍后刷新内容。" className="min-h-72" /> : null}
      {content ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>精选日期：{content.date}</span>
            {content.notice ? <span>{content.notice}</span> : null}
          </div>
          <ContentSection title="文章" items={content.articles} kind="article" targetItem={targetItem} />
          <ContentSection title="视频" items={content.videos} kind="video" targetItem={targetItem} />
        </>
      ) : null}
    </section>
  )
}
