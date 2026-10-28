import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarCheck2, RefreshCw, Sparkles } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"

import { StatePanel } from "@/components/feedback/StatePanel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { generateDailyReview, getDailyReview, reviewKeys } from "./review-api"
import type { ReviewDraft } from "./types"

const metricLabels: Record<string, string> = {
  total: "全部任务",
  open: "待办任务",
  overdue: "已逾期",
  highPriority: "高优先级",
  todayDue: "今日截止",
  completedTotal: "累计完成",
  completionRate: "完成率",
  needReport: "需要汇报",
}

function ReviewList({ title, items, description }: { title: string; items: string[]; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        ) : <p className="text-sm text-muted-foreground">暂无内容</p>}
      </CardContent>
    </Card>
  )
}

function ReviewContent({ review }: { review: ReviewDraft }) {
  const metrics = Object.entries(review.metrics)
  return (
    <div className="space-y-6" aria-label={`${review.date} 复盘内容`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarCheck2 className="size-5 text-primary" aria-hidden="true" />{review.date} 工作数据</CardTitle>
          <CardDescription>基于当前任务记录汇总，生成后可继续核对与调整工作安排。</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.length ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {metrics.map(([key, value]) => (
                <div key={key} className="rounded-lg bg-muted/60 p-3">
                  <dt className="text-xs text-muted-foreground">{metricLabels[key] ?? key}</dt>
                  <dd className="mt-1 text-lg font-semibold">{value}{key === "completionRate" && typeof value === "number" ? "%" : ""}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-sm text-muted-foreground">暂无工作数据</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "逾期分析", value: review.overdueAnalysis },
          { title: "汇报质量", value: review.reportQuality },
          { title: "协作问题", value: review.collabIssues },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader><CardTitle className="text-base">{item.title}</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm leading-6">{item.value || "暂无内容"}</p></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ReviewList title="今日亮点" items={review.highlights} description="记录已经取得的进展。" />
        <ReviewList title="改进点" items={review.improvements} description="识别下一次可以做得更好的地方。" />
        <ReviewList title="明日目标" items={review.tomorrowGoals} description="把复盘转化为明确的下一步。" />
      </div>
    </div>
  )
}

export function ReviewPage() {
  const queryClient = useQueryClient()
  const reviewQuery = useQuery({ queryKey: reviewKeys.daily(), queryFn: ({ signal }) => getDailyReview(signal) })
  const generateMutation = useMutation({
    mutationFn: generateDailyReview,
    onSuccess: (review) => {
      queryClient.setQueryData(reviewKeys.daily(), review)
      toast.success("复盘已生成")
    },
  })

  useEffect(() => {
    document.title = "工作复盘 · 个人工作看板"
  }, [])

  function generate() {
    if (!generateMutation.isPending) generateMutation.mutate()
  }

  return (
    <section aria-labelledby="review-title" className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="review-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">工作复盘</h1>
          <p className="mt-2 text-sm text-muted-foreground">回顾今日工作，沉淀亮点、改进点与明日目标。</p>
        </div>
        <Button disabled={generateMutation.isPending} aria-busy={generateMutation.isPending} onClick={generate}>
          {generateMutation.isPending ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {generateMutation.isPending ? "正在生成今日复盘" : "生成今日复盘"}
        </Button>
      </header>

      {generateMutation.isPending ? (
        <div role="status" aria-live="polite" className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          正在根据今日工作数据生成复盘，已有内容会保留，请勿重复提交。
        </div>
      ) : null}
      {generateMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>复盘生成失败</AlertTitle>
          <AlertDescription>{generateMutation.error instanceof Error ? generateMutation.error.message : "请稍后重试。"} 已有草稿未受影响，可再次生成。</AlertDescription>
        </Alert>
      ) : null}

      {reviewQuery.isPending ? <StatePanel status="loading" title="正在加载今日复盘" className="min-h-72" /> : null}
      {reviewQuery.isError ? (
        <StatePanel
          status="error"
          title="复盘加载失败"
          description={reviewQuery.error instanceof Error ? reviewQuery.error.message : "请稍后重试。"}
          onRetry={() => void reviewQuery.refetch()}
          className="min-h-72"
        />
      ) : null}
      {reviewQuery.data === null ? (
        <StatePanel status="empty" title="尚未生成今日复盘" description="点击“生成今日复盘”，根据现有任务数据创建草稿。" className="min-h-72" />
      ) : null}
      {reviewQuery.data ? <ReviewContent review={reviewQuery.data} /> : null}
    </section>
  )
}
