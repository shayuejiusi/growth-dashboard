import { ConfirmDialog } from "@/components/feedback/ConfirmDialog"

interface ClearTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ClearTasksDialog({ open, onOpenChange, onConfirm }: ClearTasksDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="清空全部任务？"
      description="此操作会永久删除当前账号的全部任务，且无法撤销。若需保留记录，请先备份任务。"
      cancelText="取消"
      actionText="清空全部任务"
      destructive
      onConfirm={onConfirm}
    />
  )
}
