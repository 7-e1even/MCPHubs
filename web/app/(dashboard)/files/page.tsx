"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  FolderOpen,
  FileText,
  Upload,
  FolderPlus,
  FilePlus,
  Trash2,
  Download,
  Pencil,
  ChevronRight,
  Home,
  RefreshCw,
  FileArchive,
  Loader2,
  ArrowLeft,
  Save,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  listFiles,
  uploadFile,
  downloadFileUrl,
  readFileContent,
  writeFileContent,
  createDirectory,
  deletePath,
  getToken,
  isLoggedIn,
  type FileItem,
} from "@/lib/api"

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return <FolderOpen className="size-4 text-amber-500" />
  const ext = name.split(".").pop()?.toLowerCase()
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext || ""))
    return <FileArchive className="size-4 text-violet-500" />
  return <FileText className="size-4 text-blue-500" />
}

// 判断是否可编辑的文本文件
function isEditableFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  const textExts = [
    "txt", "md", "py", "js", "ts", "tsx", "jsx", "json", "yaml", "yml",
    "toml", "cfg", "ini", "sh", "bash", "zsh", "fish",
    "html", "css", "scss", "less", "xml", "svg",
    "env", "gitignore", "dockerignore", "editorconfig",
    "sql", "graphql", "proto", "rs", "go", "java", "kt",
    "c", "cpp", "h", "hpp", "cs", "rb", "php", "lua",
    "r", "R", "jl", "ex", "exs", "erl", "hs",
    "makefile", "cmake", "gradle",
    "conf", "properties", "lock",
  ]
  // 也包括无扩展名的常见文件
  const noExtNames = [
    "Makefile", "Dockerfile", "Vagrantfile", "Procfile",
    "LICENSE", "README", "CHANGELOG",
    ".env", ".gitignore", ".dockerignore",
  ]
  return textExts.includes(ext) || noExtNames.includes(name)
}

// Monaco language mapping
function getMonacoLanguage(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    py: "python", js: "javascript", ts: "typescript", tsx: "typescript",
    jsx: "javascript", json: "json", yaml: "yaml", yml: "yaml",
    toml: "ini", html: "html", css: "css", scss: "scss",
    xml: "xml", sql: "sql", sh: "shell", bash: "shell",
    md: "markdown", rs: "rust", go: "go", java: "java",
    cpp: "cpp", c: "c", cs: "csharp", rb: "ruby",
    php: "php", lua: "lua", r: "r", dockerfile: "dockerfile",
  }
  if (name === "Dockerfile") return "dockerfile"
  return map[ext] || "plaintext"
}

export default function FilesPage() {
  const router = useRouter()
  const [currentPath, setCurrentPath] = useState("")
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [autoExtract, setAutoExtract] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Mkdir state
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [newDirName, setNewDirName] = useState("")

  // New file state
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [newFileName, setNewFileName] = useState("")

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; path: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Editor state
  const [editFile, setEditFile] = useState<{ path: string; name: string; content: string } | null>(null)
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await listFiles(path)
      setItems(res.items)
      setCurrentPath(path)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load files")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login")
      return
    }
    loadFiles("")
  }, [router, loadFiles])

  const navigateTo = (path: string) => loadFiles(path)

  const breadcrumbs = currentPath
    ? currentPath.split("/").filter(Boolean)
    : []

  // ─── Upload ───
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadFile(files[i], currentPath, autoExtract && files[i].name.endsWith(".zip"))
      }
      await loadFiles(currentPath)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  // ─── Drag & Drop ───
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  // ─── Mkdir ───
  const handleMkdir = async () => {
    if (!newDirName.trim()) return
    try {
      const path = currentPath ? `${currentPath}/${newDirName}` : newDirName
      await createDirectory(path)
      setMkdirOpen(false)
      setNewDirName("")
      await loadFiles(currentPath)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create directory")
    }
  }

  // ─── New File ───
  const handleNewFile = async () => {
    if (!newFileName.trim()) return
    try {
      const path = currentPath ? `${currentPath}/${newFileName}` : newFileName
      await writeFileContent(path, "")
      setNewFileOpen(false)
      setNewFileName("")
      await loadFiles(currentPath)
      // 自动打开编辑器
      openEditor(newFileName)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create file")
    }
  }

  // ─── Delete ───
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePath(deleteTarget.path)
      setDeleteTarget(null)
      await loadFiles(currentPath)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  // ─── Edit ───
  const openEditor = async (name: string) => {
    const path = currentPath ? `${currentPath}/${name}` : name
    setEditLoading(true)
    setEditFile({ path, name, content: "" })
    try {
      const res = await readFileContent(path)
      setEditFile({ path, name, content: res.content })
      setEditContent(res.content)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to read file")
      setEditFile(null)
    } finally {
      setEditLoading(false)
    }
  }

  const handleSave = async () => {
    if (!editFile) return
    setSaving(true)
    try {
      await writeFileContent(editFile.path, editContent)
      setEditFile(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  // ─── Download ───
  const handleDownload = (name: string) => {
    const path = currentPath ? `${currentPath}/${name}` : name
    const url = downloadFileUrl(path)
    const token = getToken()
    // 通过 fetch + blob 下载（带鉴权）
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  const itemPath = (name: string) => currentPath ? `${currentPath}/${name}` : name

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">File Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理服务器文件，上传自研 MCP 工具
          </p>
        </div>
      </div>

      <Separator />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-md flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="icon" className="size-6" onClick={() => setError("")}>
            <X className="size-3" />
          </Button>
        </div>
      )}

      <Card className="shadow-sm">
        {/* Toolbar */}
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm min-w-0 flex-1 overflow-hidden">
              <button
                onClick={() => navigateTo("")}
                className="hover:text-primary transition-colors shrink-0"
              >
                <Home className="size-4" />
              </button>
              {breadcrumbs.map((part, i) => {
                const path = breadcrumbs.slice(0, i + 1).join("/")
                return (
                  <span key={i} className="flex items-center gap-1 min-w-0">
                    <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                    <button
                      onClick={() => navigateTo(path)}
                      className="hover:text-primary transition-colors truncate max-w-[150px]"
                    >
                      {part}
                    </button>
                  </span>
                )
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 mr-2">
                <Checkbox
                  id="auto-extract"
                  checked={autoExtract}
                  onCheckedChange={(v) => setAutoExtract(!!v)}
                />
                <label htmlFor="auto-extract" className="text-xs text-muted-foreground cursor-pointer select-none">
                  ZIP 自动解压
                </label>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />}
                Upload
              </Button>

              <Button variant="outline" size="sm" onClick={() => setMkdirOpen(true)}>
                <FolderPlus className="size-4 mr-1.5" />
                New Folder
              </Button>

              <Button variant="outline" size="sm" onClick={() => setNewFileOpen(true)}>
                <FilePlus className="size-4 mr-1.5" />
                New File
              </Button>

              {currentPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const parts = currentPath.split("/").filter(Boolean)
                    parts.pop()
                    navigateTo(parts.join("/"))
                  }}
                >
                  <ArrowLeft className="size-4 mr-1.5" />
                  Back
                </Button>
              )}

              <Button variant="ghost" size="icon" className="size-8" onClick={() => loadFiles(currentPath)}>
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* File List */}
        <CardContent
          className={`p-0 min-h-[300px] transition-colors ${dragOver ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <FolderOpen className="size-12 opacity-30 mb-3" />
              <p className="font-medium">空目录</p>
              <p className="text-xs mt-1">拖拽文件到此处上传，或点击 Upload 按钮</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50%]">Name</TableHead>
                  <TableHead className="w-[15%]">Size</TableHead>
                  <TableHead className="w-[20%]">Modified</TableHead>
                  <TableHead className="w-[15%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.name}
                    className={`group ${item.is_dir ? "cursor-pointer" : ""}`}
                    onDoubleClick={() => item.is_dir && navigateTo(itemPath(item.name))}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {getFileIcon(item.name, item.is_dir)}
                        {item.is_dir ? (
                          <button
                            className="font-medium hover:text-primary transition-colors truncate"
                            onClick={() => navigateTo(itemPath(item.name))}
                          >
                            {item.name}
                          </button>
                        ) : (
                          <span className="truncate">{item.name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatSize(item.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatTime(item.modified)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!item.is_dir && isEditableFile(item.name) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Edit"
                            onClick={() => openEditor(item.name)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {!item.is_dir && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Download"
                            onClick={() => handleDownload(item.name)}
                          >
                            <Download className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={() =>
                            setDeleteTarget({ name: item.name, path: itemPath(item.name) })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mkdir Dialog */}
      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>输入新目录名称</DialogDescription>
          </DialogHeader>
          <Input
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            placeholder="folder-name"
            onKeyDown={(e) => e.key === "Enter" && handleMkdir()}
          />
          <DialogFooter>
            <Button onClick={handleMkdir} disabled={!newDirName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>输入新文件名称（含扩展名）</DialogDescription>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="example.py"
            onKeyDown={(e) => e.key === "Enter" && handleNewFile()}
          />
          <DialogFooter>
            <Button onClick={handleNewFile} disabled={!newFileName.trim()}>
              Create & Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除 <span className="font-semibold text-foreground">{deleteTarget?.name}</span> 吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor Dialog */}
      <Dialog open={!!editFile} onOpenChange={() => setEditFile(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-[90vw] h-[90vh] flex flex-col p-0 gap-0" showCloseButton={false} style={{ backgroundColor: "var(--background)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-blue-500" />
              <span className="font-medium text-sm">{editFile?.name}</span>
              <Badge variant="secondary" className="text-[10px]">
                {editFile?.name ? getMonacoLanguage(editFile.name) : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditFile(null)}>
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {editLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MonacoEditorWrapper
                value={editContent}
                onChange={setEditContent}
                language={editFile?.name ? getMonacoLanguage(editFile.name) : "plaintext"}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Lazy-loaded Monaco Editor wrapper
function MonacoEditorWrapper({
  value,
  onChange,
  language,
}: {
  value: string
  onChange: (v: string) => void
  language: string
}) {
  const [Editor, setEditor] = useState<any>(null)

  useEffect(() => {
    import("@monaco-editor/react").then((mod) => {
      setEditor(() => mod.default)
    })
  }, [])

  if (!Editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      value={value}
      onChange={(v: string | undefined) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12 },
      }}
    />
  )
}
