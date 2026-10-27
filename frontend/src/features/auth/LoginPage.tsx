import { useEffect, useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLogin, useSession } from "./use-session"

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string }
}

export function LoginPage() {
  const { data: user } = useSession()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const state = location.state as LoginLocationState | null
  const destination = `${state?.from?.pathname ?? "/dashboard"}${state?.from?.search ?? ""}${state?.from?.hash ?? ""}`

  useEffect(() => {
    document.title = "登录 · 个人工作看板"
  }, [])

  if (user) return <Navigate to={destination} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await login.mutateAsync({ username: username.trim(), password })
      toast.success("登录成功")
      navigate(destination, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试。")
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground" aria-hidden="true">墨</div>
          <p className="text-sm font-medium text-primary">个人工作看板</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">欢迎回来</h1>
          <p className="mt-2 text-sm text-muted-foreground">登录后继续安排今天的工作</p>
        </div>
        <Card className="shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>账号登录</CardTitle>
            <CardDescription>使用你的账号和密码登录</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <Alert variant="destructive" className="mb-5">
                <AlertTitle>登录失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" name="username" autoComplete="username" autoFocus required value={username} onChange={(event) => setUsername(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? "正在登录…" : "登录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
