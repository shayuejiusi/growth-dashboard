import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog"
import { FormDrawer } from "@/components/feedback/FormDrawer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addRosterMember, createRoster, deleteRoster, deleteRosterMember, talentKeys, updateRosterMember } from "./talent-api"
import type { Member, MemberInput, TalentBoard } from "./types"

const memberSchema = z.object({
  name: z.string().trim().min(1, "请输入成员姓名").max(50, "姓名最多 50 个字符"),
  role: z.string().trim().max(50, "角色最多 50 个字符"),
})
const rosterSchema = z.object({ name: z.string().trim().min(1, "请输入名册名称").max(20, "名册名称最长 20 字") })
type MemberValues = z.infer<typeof memberSchema>
type RosterValues = z.infer<typeof rosterSchema>

interface RosterDrawerProps {
  open: boolean
  roster: string | null
  board: TalentBoard
  onOpenChange: (open: boolean) => void
}

export function RosterDrawer(props: RosterDrawerProps) {
  return props.open ? <OpenRosterDrawer key={props.roster ?? "new"} {...props} /> : null
}

function OpenRosterDrawer(props: RosterDrawerProps) {
  return props.roster === null ? <NewRosterForm {...props} /> : <ManageRoster {...props} roster={props.roster} />
}

function NewRosterForm({ onOpenChange }: RosterDrawerProps) {
  const queryClient = useQueryClient()
  const form = useForm<RosterValues>({ resolver: zodResolver(rosterSchema), defaultValues: { name: "" } })
  const mutation = useMutation({
    mutationFn: createRoster,
    onSuccess: async () => {
      toast.success("名册已创建")
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: talentKeys.all })
    },
  })
  const { register, handleSubmit, formState: { errors, isDirty } } = form

  return (
    <FormDrawer open onOpenChange={onOpenChange} dirty={isDirty} title="新建名册" description="按团队或人员类型建立分组，名称最长 20 字。">
      {(requestClose) => (
        <form className="space-y-5" onSubmit={handleSubmit((values) => {
          if (!mutation.isPending) mutation.mutate(values.name.trim())
        })} noValidate>
          <div className="space-y-2">
            <Label htmlFor="roster-name">名册名称</Label>
            <Input id="roster-name" autoFocus maxLength={20} aria-invalid={Boolean(errors.name)} aria-describedby="roster-name-error" {...register("name")} />
            {errors.name ? <p id="roster-name-error" className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>
          {mutation.isError ? <MutationError error={mutation.error} /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={requestClose}>取消</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "正在创建…" : "创建名册"}</Button>
          </div>
        </form>
      )}
    </FormDrawer>
  )
}

function ManageRoster({ roster, board, onOpenChange }: RosterDrawerProps & { roster: string }) {
  const queryClient = useQueryClient()
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [deletingMember, setDeletingMember] = useState<Member | null>(null)
  const [deletingRoster, setDeletingRoster] = useState(false)
  const members = board.rosters[roster] ?? []
  const noteCount = (name: string) => board.people.filter((person) => person.roster === roster && person.name === name).length
  const rosterNotes = board.people.filter((person) => person.roster === roster).length

  const addMutation = useMutation({
    mutationFn: (input: MemberInput) => addRosterMember(roster, input),
    onSuccess: async () => {
      toast.success("成员已添加")
      await queryClient.invalidateQueries({ queryKey: talentKeys.all })
    },
  })
  const editMutation = useMutation({
    mutationFn: ({ name, input }: { name: string; input: MemberInput }) => updateRosterMember(roster, name, input),
    onSuccess: async () => {
      setEditingMember(null)
      toast.success("成员已更新")
      await queryClient.invalidateQueries({ queryKey: talentKeys.all })
    },
  })
  const deleteMemberMutation = useMutation({
    mutationFn: (name: string) => deleteRosterMember(roster, name),
    onSuccess: async () => {
      setDeletingMember(null)
      toast.success("成员已删除")
      await queryClient.invalidateQueries({ queryKey: talentKeys.all })
    },
  })
  const deleteRosterMutation = useMutation({
    mutationFn: () => deleteRoster(roster),
    onSuccess: async (result) => {
      setDeletingRoster(false)
      onOpenChange(false)
      toast.success(`已删除名册（含 ${result.removedMembers} 名成员、${result.removedNotes} 条观察记录）`)
      await queryClient.invalidateQueries({ queryKey: talentKeys.all })
    },
  })
  const writePending = addMutation.isPending || editMutation.isPending || deleteMemberMutation.isPending || deleteRosterMutation.isPending

  if (editingMember) {
    return (
      <EditMemberForm
        key={editingMember.name}
        member={editingMember}
        pending={editMutation.isPending}
        error={editMutation.isError ? editMutation.error : null}
        onOpenChange={onOpenChange}
        onBack={() => setEditingMember(null)}
        onSubmit={(input) => editMutation.mutateAsync({ name: editingMember.name, input }).then(() => undefined)}
      />
    )
  }

  return (
    <>
      <FormDrawer open onOpenChange={onOpenChange} dirty={false} title={`管理名册：${roster}`} description={`${members.length} 名成员 · ${rosterNotes} 条观察记录`}>
        <div className="space-y-6">
          <section aria-labelledby="roster-members-title" className="space-y-3">
            <h3 id="roster-members-title" className="font-medium">成员列表</h3>
            {members.length ? (
              <ul className="divide-y rounded-lg border">
                {members.map((member) => (
                  <li key={member.name} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{member.name}</p><p className="text-sm text-muted-foreground">{member.role}</p></div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={writePending} aria-label={`编辑成员 ${member.name}`} onClick={() => setEditingMember(member)}><Pencil aria-hidden="true" />编辑</Button>
                      <Button type="button" variant="destructive" size="sm" disabled={writePending} aria-label={`删除成员 ${member.name}`} onClick={() => setDeletingMember(member)}><Trash2 aria-hidden="true" />删除</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">名册为空，请在下方添加成员。</p>}
          </section>

          <AddMemberForm
            pending={addMutation.isPending || writePending}
            error={addMutation.isError ? addMutation.error : null}
            onSubmit={async (input) => { await addMutation.mutateAsync(input) }}
          />

          <section className="space-y-3 border-t pt-5">
            <h3 className="font-medium text-destructive">危险操作</h3>
            <p className="text-sm text-muted-foreground">删除名册会同时删除组内成员及其九宫格观察记录。</p>
            <Button type="button" variant="destructive" disabled={writePending} onClick={() => setDeletingRoster(true)}><Trash2 aria-hidden="true" />删除名册</Button>
          </section>
          {deleteMemberMutation.isError ? <MutationError error={deleteMemberMutation.error} /> : null}
          {deleteRosterMutation.isError ? <MutationError error={deleteRosterMutation.error} /> : null}
        </div>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(deletingMember)}
        onOpenChange={(open) => { if (!open && !deleteMemberMutation.isPending) setDeletingMember(null) }}
        title="删除成员"
        description={deletingMember ? `确认从“${roster}”删除“${deletingMember.name}”？其 ${noteCount(deletingMember.name)} 条九宫格观察记录将一并删除。` : ""}
        cancelText="取消"
        actionText={deleteMemberMutation.isPending ? "正在删除…" : "确认删除"}
        destructive
        onConfirm={() => {
          if (deletingMember && !deleteMemberMutation.isPending) void deleteMemberMutation.mutateAsync(deletingMember.name).catch(() => undefined)
        }}
      />
      <ConfirmDialog
        open={deletingRoster}
        onOpenChange={(open) => { if (!deleteRosterMutation.isPending) setDeletingRoster(open) }}
        title={`删除名册“${roster}”`}
        description={`此操作将连带删除组内 ${members.length} 名成员及 ${rosterNotes} 条九宫格观察记录，所有相关内容一并删除且无法恢复。`}
        cancelText="取消"
        actionText={deleteRosterMutation.isPending ? "正在删除…" : "确认删除名册"}
        destructive
        onConfirm={() => { if (!deleteRosterMutation.isPending) deleteRosterMutation.mutate() }}
      />
    </>
  )
}

function AddMemberForm({ onSubmit, pending, error }: { onSubmit: (input: MemberInput) => Promise<void>; pending: boolean; error: Error | null }) {
  const form = useForm<MemberValues>({ resolver: zodResolver(memberSchema), defaultValues: { name: "", role: "" } })
  const { register, handleSubmit, reset, formState: { errors } } = form

  async function submit(values: MemberValues) {
    if (pending) return
    try {
      await onSubmit({ name: values.name.trim(), role: values.role.trim() })
      reset()
    } catch {
      // 请求错误由当前表单展示，保留用户输入。
    }
  }

  return (
    <form className="space-y-4 border-t pt-5" onSubmit={handleSubmit(submit)} noValidate>
      <h3 className="font-medium">添加成员</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="member-name">成员姓名</Label>
          <Input id="member-name" maxLength={50} aria-invalid={Boolean(errors.name)} {...register("name")} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-role">成员角色</Label>
          <Input id="member-role" maxLength={50} placeholder="默认为成员" {...register("role")} />
          {errors.role ? <p className="text-sm text-destructive">{errors.role.message}</p> : null}
        </div>
      </div>
      {error ? <MutationError error={error} /> : null}
      <Button type="submit" variant="outline" disabled={pending}><Plus aria-hidden="true" />{pending ? "正在添加…" : "添加成员"}</Button>
    </form>
  )
}

function EditMemberForm({ member, pending, error, onSubmit, onOpenChange, onBack }: {
  member: Member
  pending: boolean
  error: Error | null
  onSubmit: (input: MemberInput) => Promise<void>
  onOpenChange: (open: boolean) => void
  onBack: () => void
}) {
  const form = useForm<MemberValues>({ resolver: zodResolver(memberSchema), defaultValues: { name: member.name, role: member.role } })
  const { register, handleSubmit, formState: { errors, isDirty } } = form
  return (
    <FormDrawer open onOpenChange={onOpenChange} dirty={isDirty} title="编辑成员" description={`修改“${member.name}”的姓名或角色；改名会同步其观察记录。`}>
      {(requestClose) => (
        <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
          if (pending) return
          try { await onSubmit({ name: values.name.trim(), role: values.role.trim() }) } catch { /* 保留输入并显示错误 */ }
        })} noValidate>
          <div className="space-y-2">
            <Label htmlFor="edit-member-name">成员姓名</Label>
            <Input id="edit-member-name" autoFocus maxLength={50} aria-invalid={Boolean(errors.name)} {...register("name")} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-member-role">成员角色</Label>
            <Input id="edit-member-role" maxLength={50} {...register("role")} />
          </div>
          {error ? <MutationError error={error} /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={pending} onClick={onBack}>返回名册</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={requestClose}>取消</Button>
            <Button type="submit" disabled={pending}>{pending ? "正在保存…" : "保存成员"}</Button>
          </div>
        </form>
      )}
    </FormDrawer>
  )
}

function MutationError({ error }: { error: Error }) {
  return <Alert variant="destructive"><AlertTitle>操作未完成</AlertTitle><AlertDescription>{error.message || "请稍后重试。"}</AlertDescription></Alert>
}
