import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateValue {
  year: number
  month: number
  day: number
}

interface DatePickerProps extends Omit<ComponentProps<typeof Button>, "type" | "value" | "onChange" | "children"> {
  value: string
  onChange: (value: string) => void
}

const weekDays = ["一", "二", "三", "四", "五", "六", "日"]

function parseDate(value: string): DateValue | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
  const nativeDate = new Date(date.year, date.month, date.day)
  return nativeDate.getFullYear() === date.year && nativeDate.getMonth() === date.month && nativeDate.getDate() === date.day ? date : null
}

function toDateString({ year, month, day }: DateValue) {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function currentMonth(value: string) {
  const date = parseDate(value) ?? (() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() }
  })()
  return { year: date.year, month: date.month }
}

function DatePicker({ value, onChange, className, ...props }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => currentMonth(value))
  const selected = parseDate(value)
  const firstDay = new Date(month.year, month.month, 1)
  const leadingDays = (firstDay.getDay() + 6) % 7
  const dayCount = new Date(month.year, month.month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((leadingDays + dayCount) / 7) * 7 }, (_, index) => index - leadingDays + 1)

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) setMonth(currentMonth(value))
  }

  function moveMonth(offset: number) {
    setMonth((current) => {
      const date = new Date(current.year, current.month + offset, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  function selectDay(day: number) {
    onChange(toDateString({ ...month, day }))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn("w-full justify-between px-3 font-normal", !selected && "text-muted-foreground", className)}
          {...props}
        >
          <span>{selected ? `${selected.year}年${selected.month + 1}月${selected.day}日` : "选择日期"}</span>
          <CalendarDays aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[19rem] p-3" aria-label="选择日期">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="上个月" onClick={() => moveMonth(-1)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h2 className="text-sm font-medium" aria-live="polite">{month.year}年{month.month + 1}月</h2>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="下个月" onClick={() => moveMonth(1)}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <table className="w-full border-collapse text-center text-sm" aria-label={`${month.year}年${month.month + 1}月日期`}>
          <thead>
            <tr>{weekDays.map((day) => <th key={day} scope="col" className="size-9 font-normal text-muted-foreground">{day}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <tr key={row}>
                {cells.slice(row * 7, row * 7 + 7).map((day, column) => {
                  const valid = day >= 1 && day <= dayCount
                  const isSelected = valid && selected?.year === month.year && selected.month === month.month && selected.day === day
                  return (
                    <td key={column} className="p-0.5">
                      {valid ? (
                        <Button
                          type="button"
                          variant={isSelected ? "default" : "ghost"}
                          size="icon-sm"
                          className="size-8 rounded-md"
                          aria-label={`${month.year}年${month.month + 1}月${day}日`}
                          aria-pressed={isSelected}
                          onClick={() => selectDay(day)}
                        >
                          {day}
                        </Button>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 border-t pt-2">
          <Button type="button" variant="ghost" size="sm" className="w-full" disabled={!value} onClick={() => { onChange(""); setOpen(false) }}>
            清除日期
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
