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
      <div className="flex flex-col h-[calc(100vh-2rem)] p-6 gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-6 max-w-[1400px] mx-auto w-full gap-6">
      {/* Header Area */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FolderOpen className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">File Manager</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[44px]">
            Manage server files & deploy custom MCP tools
          </p>
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1 font-normal">
              <span>{error}</span>
              <button onClick={() => setError("")} className="hover:opacity-80">
                <X className="size-3" />
              </button>
            </Badge>
          )}
        </div>
      </div>

      <Card className="flex-1 flex flex-col shadow-sm border-border/50 overflow-hidden bg-background/50 backdrop-blur-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/20 shrink-0 gap-4 flex-wrap">
          {/* Path Bar */}
          <div className="flex items-center px-3 py-1.5 bg-background border rounded-md text-sm min-w-[200px] flex-1 max-w-2xl shadow-sm">
            <button
              onClick={() => navigateTo("")}
              className="hover:text-primary transition-colors text-muted-foreground"
            >
              <Home className="size-4" />
            </button>
            {breadcrumbs.length > 0 && <ChevronRight className="size-4 mx-1 text-muted-foreground/50 shrink-0" />}
            {breadcrumbs.map((part, i) => {
              const path = breadcrumbs.slice(0, i + 1).join("/")
              const isLast = i === breadcrumbs.length - 1
              return (
                <span key={i} className="flex items-center min-w-0">
                  <button
                    onClick={() => navigateTo(path)}
                    className={`hover:text-primary transition-colors truncate max-w-[150px] ${
                      isLast ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {part}
                  </button>
                  {!isLast && <ChevronRight className="size-4 mx-1 text-muted-foreground/50 shrink-0" />}
                </span>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer mr-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
              <Checkbox
                checked={autoExtract}
                onCheckedChange={(v) => setAutoExtract(!!v)}
                className="size-3.5 rounded-[3px]"
              />
              <span className="select-none font-medium">Auto-Extract ZIPs</span>
            </label>

            <div className="h-4 w-px bg-border mx-1" />

            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => loadFiles(currentPath)}>
              <RefreshCw className="size-4" />
            </Button>

            {currentPath && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const parts = currentPath.split("/").filter(Boolean)
                  parts.pop()
                  navigateTo(parts.join("/"))
                }}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}

            <div className="h-4 w-px bg-border mx-1" />

            <Button variant="outline" size="sm" onClick={() => setNewFileOpen(true)} className="h-8 shadow-sm">
              <FilePlus className="size-4 mr-1.5 text-muted-foreground" />
              New File
            </Button>

            <Button variant="outline" size="sm" onClick={() => setMkdirOpen(true)} className="h-8 shadow-sm">
              <FolderPlus className="size-4 mr-1.5 text-muted-foreground" />
              New Folder
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 shadow-sm"
            >
              {uploading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />}
              Upload Files
            </Button>
          </div>
        </div>

        {/* File List Area */}
        <div
          className={`flex-1 overflow-auto relative transition-colors ${
            dragOver ? "bg-primary/5 inset-ring-2 inset-ring-primary/20" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
              <Loader2 className="size-8 animate-spin text-primary/50" />
            </div>
          ) : null}

          {items.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
              <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 ring-1 ring-border shadow-sm">
                <FolderOpen className="size-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Folder is empty</h3>
              <p className="text-sm text-center max-w-sm">
                Drag and drop files here to upload, or use the buttons above to create new files and folders.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm shadow-[0_1px_0_hsl(var(--border))] z-10">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-[50%] font-medium">Name</TableHead>
                  <TableHead className="w-[15%] font-medium">Size</TableHead>
                  <TableHead className="w-[20%] font-medium">Modified</TableHead>
                  <TableHead className="w-[15%] text-right font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.name}
                    className={`group border-border/50 transition-colors ${
                      item.is_dir ? "cursor-pointer hover:bg-muted/40" : "hover:bg-muted/20"
                    }`}
                    onDoubleClick={() => item.is_dir && navigateTo(itemPath(item.name))}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 drop-shadow-sm">
                          {getFileIcon(item.name, item.is_dir)}
                        </div>
                        {item.is_dir ? (
                          <button
                            className="font-medium hover:text-primary transition-colors truncate text-left"
                            onClick={() => navigateTo(itemPath(item.name))}
                          >
                            {item.name}
                          </button>
                        ) : (
                          <span className="truncate font-medium text-muted-foreground">{item.name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">
                      {formatSize(item.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">
                      {formatTime(item.modified)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!item.is_dir && isEditableFile(item.name) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 hover:bg-primary/10 hover:text-primary"
                            title="Edit"
                            onClick={(e) => { e.stopPropagation(); openEditor(item.name); }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {!item.is_dir && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 hover:bg-primary/10 hover:text-primary"
                            title="Download"
                            onClick={(e) => { e.stopPropagation(); handleDownload(item.name); }}
                          >
                            <Download className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ name: item.name, path: itemPath(item.name) })
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Drop Overlay */}
          {dragOver && (
            <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center bg-background border-2 border-primary border-dashed rounded-xl p-10 shadow-2xl">
                <Upload className="size-12 text-primary animate-bounce mb-4" />
                <h3 className="text-xl font-bold">Drop files to upload</h3>
                <p className="text-muted-foreground mt-2">Files will be saved to current folder</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Mkdir Dialog */}
      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name for the new directory.</DialogDescription>
          </DialogHeader>
          <Input
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            placeholder="e.g. models"
            className="mt-2"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleMkdir()}
          />
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setMkdirOpen(false)}>Cancel</Button>
            <Button onClick={handleMkdir} disabled={!newDirName.trim()}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>Enter file name with extension.</DialogDescription>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="e.g. main.py"
            className="mt-2"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleNewFile()}
          />
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setNewFileOpen(false)}>Cancel</Button>
            <Button onClick={handleNewFile} disabled={!newFileName.trim()}>Create & Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor Dialog */}
      <Dialog open={!!editFile} onOpenChange={(open) => !open && setEditFile(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border-border/40 shadow-2xl" showCloseButton={false} style={{ backgroundColor: "#1e1e1e" }}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-[#252526] text-[#cccccc] border-b border-[#3c3c3c]">
            <div className="flex items-center gap-3">
              <FileText className="size-4 text-blue-400" />
              <span className="font-medium text-sm tracking-wide">{editFile?.name}</span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono bg-black/20 border-[#3c3c3c] text-muted-foreground">
                {editFile?.name ? getMonacoLanguage(editFile.name) : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-3 hidden sm:inline-block">Ctrl+S to save</span>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary/20 hover:bg-primary/30 text-primary-foreground h-8 border-none" variant="outline">
                {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}
                Save
              </Button>
              <div className="w-px h-4 bg-[#3c3c3c] mx-2" />
              <Button size="sm" variant="ghost" onClick={() => setEditFile(null)} className="size-8 p-0 hover:bg-white/10 text-muted-foreground hover:text-white rounded-md">
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            {editLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]">
                <Loader2 className="size-8 animate-spin text-[#cccccc]/30" />
              </div>
            ) : (
              <div className="absolute inset-0" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); } }}>
                <MonacoEditorWrapper
                  value={editContent}
                  onChange={setEditContent}
                  language={editFile?.name ? getMonacoLanguage(editFile.name) : "plaintext"}
                />
              </div>
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
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
        lineNumbers: "on",
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 16 },
        renderLineHighlight: "all",
        matchBrackets: "near",
        bracketPairColorization: { enabled: true },
      }}
    />
  )
}
