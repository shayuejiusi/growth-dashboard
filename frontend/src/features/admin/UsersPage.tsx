import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog"
import { StatePanel } from "@/components/feedback/StatePanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSession } from "@/features/auth/use-session"
import { adminKeys, createUser, deleteUser, getUsers, resetUserPassword } from "./admin-api"
import type { AdminUser, CreateUserInput, ResetPasswordInput } from "./types"
import { UserFormDrawer } from "./UserFormDrawer"

const levelNames = { 1: "一级权限", 2: "二级权限", 3: "三级权限" } as const

export function UsersPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const usersQuery = useQuery({ queryKey: adminKeys.users(), queryFn: ({ signal }) => getUsers(signal) })
  const [form, setForm] = useState<{ mode: "create" } | { mode: "reset"; user: AdminUser } | null>(null)
  const [deleting, setDeleting] = useState<AdminUser | null>(null)

  useEffect(() => {
    document.title = "账号管理 · 个人工作看板"
  }, [])

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: adminKeys.users() })
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setForm(null)
      toast.success("用户已添加")
      await invalidateUsers()
    },
  })
  const resetMutation = useMutation({
    mutationFn: ({ username, input }: { username: string; input: ResetPasswordInput }) => resetUserPassword(username, input),
    onSuccess: async () => {
      setForm(null)
      toast.success("密码已重置，该用户需重新登录")
      await invalidateUsers()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (username: string) => deleteUser(username),
    onSuccess: async () => {
      setDeleting(null)
      toast.success("用户已删除")
      await invalidateUsers()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "删除失败，请重试。"),
  })
  const writePending = createMutation.isPending || resetMutation.isPending || deleteMutation.isPending
  const users = usersQuery.data ?? []

  async function submitCreate(input: CreateUserInput) {
    await createMutation.mutateAsync(input)
  }

  return (
    <section aria-labelledby="users-title" className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="users-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">账号管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">管理登录账号与权限等级，密码仅以隐藏形式录入。</p>
        </div>
        <Button disabled={writePending} onClick={() => setForm({ mode: "create" })}><Plus aria-hidden="true" />新增用户</Button>
      </header>

      {usersQuery.isPending ? <StatePanel status="loading" title="正在加载账号" className="min-h-72" /> : null}
      {usersQuery.isError ? (
        <StatePanel
          status="error"
          title="账号加载失败"
          description={usersQuery.error instanceof Error ? usersQuery.error.message : "请稍后重试。"}
          onRetry={() => void usersQuery.refetch()}
          className="min-h-72"
        />
      ) : null}
      {usersQuery.data && users.length === 0 ? (
        <StatePanel status="empty" title="暂无账号" description="点击“新增用户”创建第一个登录账号。" className="min-h-72" />
      ) : null}
      {users.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>权限等级</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.username}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell><Badge variant={user.level === 1 ? "default" : "secondary"}>{levelNames[user.level]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={writePending}
                          aria-label={`重置 ${user.username} 的密码`}
                          onClick={() => setForm({ mode: "reset", user })}
                        >
                          <KeyRound aria-hidden="true" /><span className="hidden lg:inline">重置密码</span>
                        </Button>
                        {session?.username !== user.username ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={writePending}
                            aria-label={`删除用户 ${user.username}`}
                            onClick={() => setDeleting(user)}
                          >
                            <Trash2 aria-hidden="true" /><span className="hidden lg:inline">删除</span>
                          </Button>
                        ) : <span className="self-center text-xs text-muted-foreground">当前账号</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {form?.mode === "create" ? (
        <UserFormDrawer
          open
          mode="create"
          pending={createMutation.isPending}
          onOpenChange={(open) => { if (!open) setForm(null) }}
          onSubmit={submitCreate}
        />
      ) : null}
      {form?.mode === "reset" ? (
        <UserFormDrawer
          open
          mode="reset"
          user={form.user}
          pending={resetMutation.isPending}
          onOpenChange={(open) => { if (!open) setForm(null) }}
          onSubmit={(input) => resetMutation.mutateAsync({ username: form.user.username, input }).then(() => undefined)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeleting(null) }}
        title="删除用户"
        description={deleting ? `确认删除用户“${deleting.username}”？该操作不可恢复。` : ""}
        cancelText="取消"
        actionText={deleteMutation.isPending ? "正在删除…" : "确认删除"}
        destructive
        onConfirm={() => {
          if (deleting && !deleteMutation.isPending) void deleteMutation.mutateAsync(deleting.username).catch(() => undefined)
        }}
      />
    </section>
  )
}
