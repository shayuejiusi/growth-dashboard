import { X } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ConfirmDialog } from "./ConfirmDialog"

interface FormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dirty: boolean
  title: string
  description?: string
  children: ReactNode | ((requestClose: () => void) => ReactNode)
}

/** 长表单容器：禁止蒙层关闭，并在有未保存修改时要求明确确认。 */
export function FormDrawer({ open, onOpenChange, dirty, title, description, children }: FormDrawerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  function requestClose() {
    if (dirty) setConfirmOpen(true)
    else onOpenChange(false)
  }

  return (
    <>
      <Drawer
        direction="right"
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpenChange(true)
          else requestClose()
        }}
      >
        <DrawerContent
          className="inset-y-0 right-0 h-full w-full sm:max-w-xl"
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DrawerHeader className="border-b text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DrawerTitle>{title}</DrawerTitle>
                {description ? <DrawerDescription>{description}</DrawerDescription> : null}
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`关闭${title}`} onClick={requestClose}>
                <X aria-hidden="true" />
              </Button>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">{typeof children === "function" ? children(requestClose) : children}</div>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="放弃未保存修改"
        description="当前表单有尚未保存的内容，关闭后这些修改将丢失。"
        cancelText="继续编辑"
        actionText="放弃修改"
        destructive
        onConfirm={() => {
          setConfirmOpen(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
