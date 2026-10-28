import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PersonNote } from "./types"

const cellNames: Record<string, string> = {
  "3-3": "明星",
  "3-2": "骨干",
  "3-1": "绩效好 · 潜力待挖",
  "2-3": "高潜待验证",
  "2-2": "中坚",
  "2-1": "稳定贡献",
  "1-3": "潜力股 · 绩效待提升",
  "1-2": "待辅导",
  "1-1": "重点关注",
}

interface NineGridProps {
  people: PersonNote[]
  onEdit: (person: PersonNote) => void
}

export function NineGrid({ people, onEdit }: NineGridProps) {
  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-3 gap-2 text-center text-xs font-medium text-muted-foreground sm:grid" aria-hidden="true">
        <span>绩效 1 · 待提升</span><span>绩效 2 · 稳定</span><span>绩效 3 · 优秀</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="人才九宫格，绩效从左到右递增，潜力从下到上递增">
        {[3, 2, 1].flatMap((potential) => [1, 2, 3].map((performance) => {
          const cellPeople = people.filter((person) => person.performance === performance && person.potential === potential)
          const label = cellNames[`${performance}-${potential}`]
          return (
            <section
              key={`${performance}-${potential}`}
              data-testid={`nine-grid-cell-${performance}-${potential}`}
              data-performance={performance}
              data-potential={potential}
              aria-label={`${label}，绩效 ${performance}，潜力 ${potential}`}
              className={cn(
                "min-h-36 rounded-lg border bg-card p-3",
                performance === 3 && potential === 3 && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium">{label}</h3>
                <Badge variant="secondary" className="shrink-0">{cellPeople.length}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground sm:hidden">绩效 {performance} · 潜力 {potential}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cellPeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    aria-label={`编辑${person.name}的观察记录`}
                    title={person.observation || "点击编辑观察记录"}
                    onClick={() => onEdit(person)}
                    className="max-w-full rounded-md bg-background px-2.5 py-1.5 text-left text-sm shadow-sm ring-1 ring-border transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block truncate">{person.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{person.roster}</span>
                  </button>
                ))}
              </div>
              {cellPeople.length === 0 ? <p className="mt-4 text-xs text-muted-foreground">暂无人员记录</p> : null}
            </section>
          )
        }))}
      </div>
      <p className="text-xs text-muted-foreground">纵轴：潜力自下而上为 1–3；横轴：绩效从左到右为 1–3。</p>
    </div>
  )
}
