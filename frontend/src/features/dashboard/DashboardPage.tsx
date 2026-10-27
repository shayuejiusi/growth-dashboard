import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Lightbulb, RefreshCw } from "lucide-react"
import { useLocation } from "react-router"
import { toast } from "sonner"

import { StatePanel } from "@/components/feedback/StatePanel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { completeTask, dashboardKeys, getAiStatus, getDashboard } from "./dashboard-api"
import { StatCards } from "./StatCards"
import { TopThree } from "./TopThree"

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24" />)}
      </div>
      <Skeleton className="h-72" />
      <StatePanel status="loading" title="正在加载驾驶舱" description="正在汇总今日任务，请稍候…" className="min-h-24 p-2" />
    </div>
  )
}

export function DashboardPage() {
  const location = useLocation()
  const denied = Boolean((location.state as { denied?: boolean } | null)?.denied)
  const queryClient = useQueryClient()
  const dashboard = useQuery({ queryKey: dashboardKeys.detail(), queryFn: ({ signal }) => getDashboard(signal) })
  const aiStatus = useQuery({ queryKey: ["ai", "status"], queryFn: ({ signal }) => getAiStatus(signal) })
  const complete = useMutation({
    mutationFn: completeTask,
    onSuccess: async () => {
      toast.success("任务已完成")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["reminders"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "完成失败，请重试。"),
  })

  return (
    <section aria-labelledby="dashboard-title" className="space-y-6">
      {denied ? (
        <Alert variant="destructive">
          <AlertTitle>没有访问权限</AlertTitle>
          <AlertDescription>当前账号无法访问该页面，已返回工作台。</AlertDescription>
        </Alert>
      ) : null}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="dashboard-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">看清重点，从容推进今天的工作。</p>
        </div>
        {aiStatus.isPending ? <Badge variant="outline">AI：状态检查中</Badge> : null}
        {aiStatus.data ? (
          <Badge variant={aiStatus.data.remoteConfigured ? "default" : "secondary"} title={aiStatus.data.hint}>
            AI：{aiStatus.data.provider}
          </Badge>
        ) : null}
      </header>

      {aiStatus.isError ? (
        <Alert>
          <AlertTitle>AI 状态暂时不可用</AlertTitle>
          <AlertDescription>
            <span>任务数据不受影响，可稍后重试状态检查。</span>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void aiStatus.refetch()}>
              <RefreshCw aria-hidden="true" />重试 AI 状态
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {dashboard.isPending ? <DashboardLoading /> : null}
      {dashboard.isError ? (
        <StatePanel
          status="error"
          title="驾驶舱加载失败"
          description={dashboard.error instanceof Error ? dashboard.error.message : "请稍后重试。"}
          onRetry={() => void dashboard.refetch()}
          className="min-h-72"
        />
      ) : null}
      {dashboard.data ? (
        <>
          <StatCards stats={dashboard.data.stats} />
          <Alert className="border-primary/20 bg-primary/5">
            <Lightbulb aria-hidden="true" />
            <AlertTitle>当前焦点</AlertTitle>
            <AlertDescription>{dashboard.data.focusNow}</AlertDescription>
          </Alert>
          <TopThree
            tasks={dashboard.data.top3}
            completingId={complete.isPending ? complete.variables : undefined}
            onComplete={(id) => complete.mutate(id)}
          />
          <p className="text-right text-xs text-muted-foreground">数据更新于 {dashboard.data.generatedAt}</p>
        </>
      ) : null}
    </section>
  )
}
