import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface PopconfirmProps {
  title: string
  description?: string
  cancelText?: string
  actionText: string
  onConfirm: () => void
  children: ReactNode
}

export function Popconfirm({
  title,
  description,
  cancelText = "取消",
  actionText,
  onConfirm,
  children,
}: PopconfirmProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <p className="font-medium">{title}</p>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{cancelText}</Button>
          <Button size="sm" onClick={() => { onConfirm(); setOpen(false) }}>{actionText}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
