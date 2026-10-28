import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { FormDrawer } from "@/components/feedback/FormDrawer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminUser, CreateUserInput, PermissionLevel, ResetPasswordInput } from "./types"

const selectClassName = "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-[3px]"

const createSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{2,20}$/, "用户名需为 2-20 位字母、数字或下划线"),
  name: z.string().trim().min(1, "请输入姓名").max(50, "姓名最多 50 个字符"),
  level: z.enum(["1", "2", "3"]),
  password: z.string().min(6, "密码至少 6 位").max(128, "密码最多 128 位"),
})
const resetSchema = z.object({ password: z.string().min(6, "密码至少 6 位").max(128, "密码最多 128 位") })

type CreateValues = z.infer<typeof createSchema>
type ResetValues = z.infer<typeof resetSchema>

interface CommonProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending?: boolean
}

type UserFormDrawerProps = CommonProps & (
  | { mode: "create"; user?: null; onSubmit: (input: CreateUserInput) => Promise<void> }
  | { mode: "reset"; user: AdminUser; onSubmit: (input: ResetPasswordInput) => Promise<void> }
)

export function UserFormDrawer(props: UserFormDrawerProps) {
  return props.open ? <OpenUserFormDrawer {...props} /> : null
}

function OpenUserFormDrawer(props: UserFormDrawerProps) {
  const isCreate = props.mode === "create"
  const title = isCreate ? "新增用户" : `重置密码：${props.user.username}`
  return (
    <FormDrawerContainer
      key={`${props.mode}-${props.user?.username ?? "new"}`}
      {...props}
      title={title}
    />
  )
}

function FormDrawerContainer(props: UserFormDrawerProps & { title: string }) {
  if (props.mode === "create") return <CreateUserForm {...props} />
  return <ResetPasswordForm {...props} />
}

function CreateUserForm({ title, onOpenChange, onSubmit, pending = false }: Extract<UserFormDrawerProps, { mode: "create" }> & { title: string }) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { username: "", name: "", level: "3", password: "" },
  })
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = form

  async function submit(values: CreateValues) {
    if (pending) return
    setSubmitError(null)
    try {
      await onSubmit({
        username: values.username.trim(),
        name: values.name.trim(),
        level: Number(values.level) as PermissionLevel,
        password: values.password,
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "添加失败，请稍后重试。")
    }
  }

  return (
    <FormDrawer open onOpenChange={onOpenChange} dirty={isDirty} title={title} description="设置登录账号、显示姓名和权限等级。">
      {(requestClose) => (
        <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="user-username">用户名</Label>
            <Input id="user-username" autoFocus autoComplete="off" maxLength={20} aria-invalid={Boolean(errors.username)} aria-describedby="user-username-error" {...register("username")} />
            {errors.username ? <p id="user-username-error" className="text-sm text-destructive">{errors.username.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-name">姓名</Label>
            <Input id="user-name" autoComplete="off" maxLength={50} aria-invalid={Boolean(errors.name)} aria-describedby="user-name-error" {...register("name")} />
            {errors.name ? <p id="user-name-error" className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-level">权限等级</Label>
            <select id="user-level" className={selectClassName} {...register("level")}>
              <option value="1">一级权限 · 全部功能</option>
              <option value="2">二级权限 · 工作与内容</option>
              <option value="3">三级权限 · 工作功能</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">密码</Label>
            <Input id="user-password" type="password" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(errors.password)} aria-describedby="user-password-error user-password-hint" {...register("password")} />
            <p id="user-password-hint" className="text-sm text-muted-foreground">至少 6 位，仅在本次创建请求中提交。</p>
            {errors.password ? <p id="user-password-error" className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>
          <FormActions
            error={submitError}
            errorTitle="用户未添加"
            pending={isSubmitting || pending}
            submitText="创建用户"
            pendingText="正在创建…"
            onCancel={requestClose}
          />
        </form>
      )}
    </FormDrawer>
  )
}

function ResetPasswordForm({ title, user, onOpenChange, onSubmit, pending = false }: Extract<UserFormDrawerProps, { mode: "reset" }> & { title: string }) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: "" } })
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = form

  async function submit(values: ResetValues) {
    if (pending) return
    setSubmitError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "重置失败，请稍后重试。")
    }
  }

  return (
    <FormDrawer open onOpenChange={onOpenChange} dirty={isDirty} title={title} description={`为 ${user.name} 设置新密码，重置后其所有会话将失效。`}>
      {(requestClose) => (
        <form className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="reset-password">新密码</Label>
            <Input id="reset-password" type="password" autoComplete="new-password" autoFocus maxLength={128} aria-invalid={Boolean(errors.password)} aria-describedby="reset-password-error" {...register("password")} />
            {errors.password ? <p id="reset-password-error" className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>
          <FormActions
            error={submitError}
            errorTitle="密码未重置"
            pending={isSubmitting || pending}
            submitText="确认重置密码"
            pendingText="正在重置…"
            onCancel={requestClose}
          />
        </form>
      )}
    </FormDrawer>
  )
}

function FormActions({ error, errorTitle, pending, submitText, pendingText, onCancel }: {
  error: string | null
  errorTitle: string
  pending: boolean
  submitText: string
  pendingText: string
  onCancel: () => void
}) {
  return (
    <div className="sticky bottom-0 -mx-1 space-y-3 border-t bg-background px-1 pt-4">
      {error ? <Alert variant="destructive"><AlertTitle>{errorTitle}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>取消</Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? pendingText : submitText}</Button>
      </div>
    </div>
  )
}
