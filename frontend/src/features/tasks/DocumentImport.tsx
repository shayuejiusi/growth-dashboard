import { FileUp, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { extractDocumentText, recognizeTasksLocally, validateImportFile, type BatchImportResult, type TaskDraft } from "./ai-api"
import { ImportPreview } from "./ImportPreview"

interface DocumentImportProps {
  writePending?: boolean
  onDirtyChange?: (dirty: boolean) => void
  onSubmittingChange?: (submitting: boolean) => void
  onImport: (drafts: TaskDraft[]) => Promise<BatchImportResult>
}

export function DocumentImport({ writePending = false, onDirtyChange, onSubmittingChange, onImport }: DocumentImportProps) {
  const [kind, setKind] = useState<"doc" | "official">("doc")
  const [text, setText] = useState("")
  const [drafts, setDrafts] = useState<TaskDraft[] | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileMessage, setFileMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onDirtyChange?.(text.trim().length > 0 || drafts !== null)
  }, [drafts, onDirtyChange, text])

  useEffect(() => {
    onSubmittingChange?.(extracting || importing)
  }, [extracting, importing, onSubmittingChange])

  function updateText(value: string) {
    setText(value)
    setDrafts(null)
    setError(null)
  }

  async function extract(file: File | undefined) {
    if (!file) return
    setError(null)
    setFileMessage(null)
    setDrafts(null)
    const validationError = validateImportFile(file)
    if (validationError) {
      setError(validationError)
      if (fileInput.current) fileInput.current.value = ""
      return
    }

    setExtracting(true)
    try {
      const result = await extractDocumentText(file)
      setText(result.text)
      setFileMessage(result.text ? `已解析 ${result.filename}（${result.chars} 字），请校对文本。` : "文件中未提取到文本，可直接粘贴内容。")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "文件解析失败，请稍后重试。")
    } finally {
      setExtracting(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  function recognize() {
    setError(null)
    const recognized = recognizeTasksLocally(text)
    if (!recognized.length) {
      setDrafts(null)
      setError("请先输入包含任务描述的文本，每个非空行将识别为一项任务。")
      return
    }
    setDrafts(recognized)
  }

  return (
    <div className="space-y-4">
      <Tabs value={kind} onValueChange={(value) => { setKind(value as "doc" | "official"); setDrafts(null) }}>
        <TabsList className="grid w-full grid-cols-2" aria-label="导入文本类型">
          <TabsTrigger value="doc">文档</TabsTrigger>
          <TabsTrigger value="official">收文</TabsTrigger>
        </TabsList>
        <TabsContent value="doc" className="pt-2 text-sm text-muted-foreground">适用于文档、会议纪要和普通工作材料。</TabsContent>
        <TabsContent value="official" className="pt-2 text-sm text-muted-foreground">适用于收文、通知或待落实文件，可在识别后校对任务。</TabsContent>
      </Tabs>

      <div className="rounded-lg border bg-card px-4 py-3 text-sm">
        <p className="font-medium">AI 功能暂未配置</p>
        <p className="mt-1 text-muted-foreground">AI 提示词和 API 暂未配置，不会请求远程分析，也不会生成或展示伪造的 AI 结果。</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="document-text">文本内容</Label>
        <Textarea
          id="document-text"
          className="min-h-32"
          value={text}
          placeholder={kind === "official" ? "粘贴收文或通知正文，每个非空行可作为一项待办。" : "粘贴文本，或选择文件提取内容；每个非空行可作为一项待办。"}
          onChange={(event) => updateText(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="document-file">选择文件</Label>
        <Input
          ref={fileInput}
          id="document-file"
          type="file"
          accept=".txt,.md,.csv,.docx,.xlsx"
          disabled={extracting || importing}
          onChange={(event) => void extract(event.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground">支持 .txt、.md、.csv、.docx、.xlsx，单个文件不超过 10MB。</p>
        {extracting ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />正在提取文件文本…</p> : null}
        {fileMessage ? <p role="status" className="text-sm text-muted-foreground">{fileMessage}</p> : null}
      </div>

      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" disabled title="AI 提示词和 API 暂未配置">AI 智能分析（暂未配置）</Button>
        <Button type="button" variant="secondary" disabled={extracting || importing || !text.trim()} onClick={recognize}><FileUp aria-hidden="true" />本地快速识别（简单规则）</Button>
      </div>
      <p className="text-xs text-muted-foreground">本地快速识别仅按非空行拆分并提取行内真实日期，不调用 AI，也不评估能力维度。</p>

      {drafts ? <ImportPreview key={JSON.stringify(drafts)} drafts={drafts} writePending={writePending} onSubmittingChange={setImporting} onImport={onImport} /> : null}
    </div>
  )
}
