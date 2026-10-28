import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FolderPlus, Pencil, Plus, Settings2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useLocation, useSearchParams } from "react-router"
import { toast } from "sonner"
import { z } from "zod"

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog"
import { FormDrawer } from "@/components/feedback/FormDrawer"
import { StatePanel } from "@/components/feedback/StatePanel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NineGrid } from "./NineGrid"
import { RosterDrawer } from "./RosterDrawer"
import { createPerson, deletePerson, getTalentBoard, talentKeys, updatePerson } from "./talent-api"
import type { Member, PersonInput, PersonNote, TalentBoard } from "./types"

const selectClassName = "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-[3px]"
const personSchema = z.object({
  member: z.string().min(1, "请选择成员"),
  performance: z.enum(["1", "2", "3"]),
  potential: z.enum(["1", "2", "3"]),
  observation: z.string().trim().max(2000, "观察记录最多 2000 个字符"),
})
type PersonValues = z.infer<typeof personSchema>
interface MemberOption extends Member { roster: string }

export function TalentPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const personId = searchParams.get("person")
  const personRequestKey = personId ? location.key : null
  const boardQuery = useQuery({ queryKey: talentKeys.board(), queryFn: ({ signal }) => getTalentBoard(signal) })
  const [personForm, setPersonForm] = useState<PersonNote | null | "new">(null)
  const [rosterDrawer, setRosterDrawer] = useState<{ open: boolean; roster: string | null }>({ open: false, roster: null })
  const [deletingPerson, setDeletingPerson] = useState<PersonNote | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [handledPersonRequest, setHandledPersonRequest] = useState<string | null>(null)
  const board = boardQuery.data ?? { rosters: {}, people: [] }
  const members = flattenMembers(board)

  if (personRequestKey && personRequestKey !== handledPersonRequest && boardQuery.data) {
    setHandledPersonRequest(personRequestKey)
    const target = boardQuery.data.people.find((person) => person.id === personId)
    if (target) {
      setLocationError(null)
      setPersonForm(target)
    } else {
      setPersonForm(null)
      setLocationError("未找到该人员观察记录，可能已删除。可继续浏览或重新搜索。")
    }
  }
  if (!personRequestKey && locationError) setLocationError(null)

  useEffect(() => {
    document.title = "人才筛选 · 个人工作看板"
  }, [])

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PersonInput }) => id ? updatePerson(id, input) : createPerson(input),
    onSuccess: async () => {
      setPersonForm(null)
      toast.success("观察记录已保存")
      await queryClient.invalidateQueries({ queryKey: talentKeys.all })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePerson(id),
    onSuccess: async () => {
      setDeletingPerson(null)
      setPersonForm(null)
      toast.success("观察记录已删除")
      await queryClient.invalidateQueries({ queryKey: talentKeys.all })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "删除失败，请重试。"),
  })

  return (
    <section aria-labelledby="talent-title" className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="talent-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">人才筛选</h1>
          <p className="mt-2 text-sm text-muted-foreground">以绩效与潜力记录人员观察，九宫格仅用于工作管理参考。</p>
        </div>
        <Button disabled={members.length === 0 || saveMutation.isPending} title={members.length === 0 ? "请先在花名册中添加成员" : undefined} onClick={() => setPersonForm("new")}>
          <Plus aria-hidden="true" />新增观察记录
        </Button>
      </header>

      {locationError ? <Alert variant="destructive"><AlertTitle>无法定位观察记录</AlertTitle><AlertDescription>{locationError}</AlertDescription></Alert> : null}
      {boardQuery.isPending ? <StatePanel status="loading" title="正在加载人才看板" className="min-h-72" /> : null}
      {boardQuery.isError ? (
        <StatePanel
          status="error"
          title="人才看板加载失败"
          description={boardQuery.error instanceof Error ? boardQuery.error.message : "请稍后重试。"}
          onRetry={() => void boardQuery.refetch()}
          className="min-h-72"
        />
      ) : null}

      {boardQuery.data ? (
        <>
          <section aria-labelledby="rosters-title" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="rosters-title" className="text-lg font-semibold">花名册</h2>
                <p className="mt-1 text-sm text-muted-foreground">先维护名册成员，再添加对应的观察记录。</p>
              </div>
              <Button variant="outline" onClick={() => setRosterDrawer({ open: true, roster: null })}><FolderPlus aria-hidden="true" />新建名册</Button>
            </div>
            {Object.keys(board.rosters).length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(board.rosters).map(([roster, rosterMembers]) => (
                  <Card key={roster}>
                    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{roster}</CardTitle>
                        <CardDescription>{rosterMembers.length} 名成员 · {board.people.filter((person) => person.roster === roster).length} 条观察记录</CardDescription>
                      </div>
                      <Badge variant="secondary">{rosterMembers.length}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="line-clamp-2 min-h-5 text-sm text-muted-foreground">
                        {rosterMembers.length ? rosterMembers.map((member) => member.name).join("、") : "暂无成员"}
                      </p>
                      <Button variant="outline" size="sm" aria-label={`管理名册 ${roster}`} onClick={() => setRosterDrawer({ open: true, roster })}><Settings2 aria-hidden="true" />管理名册</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <StatePanel status="empty" title="暂无名册" description="点击“新建名册”创建分组并添加成员。" className="min-h-40 rounded-lg border" />}
          </section>

          <section aria-labelledby="nine-grid-title" className="space-y-4">
            <div>
              <h2 id="nine-grid-title" className="text-lg font-semibold">人才九宫格</h2>
              <p className="mt-1 text-sm text-muted-foreground">点击人员姓名可编辑或删除观察记录。</p>
            </div>
            <NineGrid people={board.people} onEdit={setPersonForm} />
          </section>
        </>
      ) : null}

      <RosterDrawer
        open={rosterDrawer.open}
        roster={rosterDrawer.roster}
        board={board}
        onOpenChange={(open) => setRosterDrawer((current) => ({ ...current, open }))}
      />
      {personForm !== null ? (
        <PersonFormDrawer
          key={personForm === "new" ? "new" : personForm.id}
          person={personForm === "new" ? null : personForm}
          members={members}
          pending={saveMutation.isPending}
          error={saveMutation.isError ? saveMutation.error : null}
          onOpenChange={(open) => { if (!open) setPersonForm(null) }}
          onSubmit={(input) => saveMutation.mutateAsync({ id: personForm === "new" ? undefined : personForm.id, input }).then(() => undefined)}
          onDelete={(person) => setDeletingPerson(person)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deletingPerson)}
        onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeletingPerson(null) }}
        title="删除观察记录"
        description={deletingPerson ? `确认删除“${deletingPerson.name}”的这条观察记录？该操作不可恢复。` : ""}
        cancelText="取消"
        actionText={deleteMutation.isPending ? "正在删除…" : "确认删除"}
        destructive
        onConfirm={() => {
          if (deletingPerson && !deleteMutation.isPending) void deleteMutation.mutateAsync(deletingPerson.id).catch(() => undefined)
        }}
      />
    </section>
  )
}

function flattenMembers(board: TalentBoard): MemberOption[] {
  return Object.entries(board.rosters).flatMap(([roster, members]) => members.map((member) => ({ ...member, roster })))
}

function PersonFormDrawer({ person, members, pending, error, onOpenChange, onSubmit, onDelete }: {
  person: PersonNote | null
  members: MemberOption[]
  pending: boolean
  error: Error | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: PersonInput) => Promise<void>
  onDelete: (person: PersonNote) => void
}) {
  const initialMember = person ? Math.max(0, members.findIndex((member) => member.name === person.name && member.roster === person.roster)) : -1
  const form = useForm<PersonValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      member: initialMember >= 0 ? String(initialMember) : "",
      performance: String(person?.performance ?? 2) as PersonValues["performance"],
      potential: String(person?.potential ?? 2) as PersonValues["potential"],
      observation: person?.observation ?? "",
    },
  })
  const { register, handleSubmit, formState: { errors, isDirty } } = form

  return (
    <FormDrawer
      open
      onOpenChange={onOpenChange}
      dirty={isDirty}
      title={person ? "编辑观察记录" : "新增观察记录"}
      description={person ? `${person.name} · ${person.roster}` : "选择名册成员，按 1–3 分记录绩效、潜力和事实观察。"}
    >
      {(requestClose) => (
        <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
          if (pending) return
          const member = members[Number(values.member)]
          if (!member) return
          try {
            await onSubmit({
              name: member.name,
              roster: member.roster,
              performance: Number(values.performance),
              potential: Number(values.potential),
              observation: values.observation.trim(),
            })
          } catch {
            // 请求失败时保留输入，由表单错误区域展示。
          }
        })} noValidate>
          <div className="space-y-2">
            <Label htmlFor="person-member">成员</Label>
            <select id="person-member" className={selectClassName} disabled={Boolean(person)} aria-invalid={Boolean(errors.member)} {...register("member")}>
              <option value="" disabled>请选择成员</option>
              {members.map((member, index) => <option key={`${member.roster}-${member.name}`} value={index}>{member.name}（{member.roster}）</option>)}
            </select>
            {errors.member ? <p className="text-sm text-destructive">{errors.member.message}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="person-performance">绩效</Label>
              <select id="person-performance" className={selectClassName} {...register("performance")}>
                <option value="1">1 · 待提升</option><option value="2">2 · 稳定</option><option value="3">3 · 优秀</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-potential">潜力</Label>
              <select id="person-potential" className={selectClassName} {...register("potential")}>
                <option value="1">1 · 待观察</option><option value="2">2 · 中等</option><option value="3">3 · 较高</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-observation">观察记录</Label>
            <Textarea id="person-observation" rows={8} maxLength={2000} placeholder="记录具体工作事实、成果和后续观察重点" {...register("observation")} />
            {errors.observation ? <p className="text-sm text-destructive">{errors.observation.message}</p> : null}
          </div>
          {error ? <Alert variant="destructive"><AlertTitle>观察记录未保存</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert> : null}
          <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t bg-background px-1 pt-4 sm:flex-row sm:justify-end">
            {person ? <Button type="button" variant="destructive" disabled={pending} onClick={() => onDelete(person)}><Trash2 aria-hidden="true" />删除观察记录</Button> : null}
            <Button type="button" variant="outline" disabled={pending} onClick={requestClose}>取消</Button>
            <Button type="submit" disabled={pending}><Pencil aria-hidden="true" />{pending ? "正在保存…" : "保存观察记录"}</Button>
          </div>
        </form>
      )}
    </FormDrawer>
  )
}
