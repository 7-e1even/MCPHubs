"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Server as ServerIcon,
  Plus,
  Trash2,
  Download,
  Terminal,
  Globe,
  Copy,
  Check,
  Search,
  FileJson,
  FormInput,
  CheckCircle2,
  AlertCircle,
  SkipForward,
  LayoutGrid,
  List,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Filter,
  Zap,
  Loader2,
  X,
  Wrench,
  Eye,
  EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  fetchServers,
  registerServer,
  deleteServer,
  updateServer,
  importServers,
  exportServers,
  testServer,
  fetchServerTools,
  updateDisabledTools,
  updateServerExposure,
  isLoggedIn,
  type MCPServer,
  type ImportResult,
  type ServerToolInfo,
} from "@/lib/api"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"

export default function ServersPage() {
  const router = useRouter()
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // View mode
  const [viewMode, setViewMode] = useState<"card" | "list">("card")

  // Search & Filters
  const [search, setSearch] = useState("")
  const [filterTransport, setFilterTransport] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE_CARD = 12
  const PAGE_SIZE_LIST = 10

  // Add Server dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addTab, setAddTab] = useState<"form" | "json">("form")

  // Form mode state
  const [addName, setAddName] = useState("")
  const [addDesc, setAddDesc] = useState("")
  const [addTransport, setAddTransport] = useState("stdio")
  const [addCommand, setAddCommand] = useState("")
  const [addArgs, setAddArgs] = useState("")
  const [addUrl, setAddUrl] = useState("")
  const [addEnv, setAddEnv] = useState("")
  const [addHeaders, setAddHeaders] = useState("")
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState("")

  // JSON mode state
  const [jsonInput, setJsonInput] = useState("")
  const [jsonSubmitting, setJsonSubmitting] = useState(false)
  const [jsonResult, setJsonResult] = useState<ImportResult | null>(null)
  const [jsonError, setJsonError] = useState("")

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"claude" | "vscode" | "generic">("claude")
  const [exportData, setExportData] = useState("")
  const [copied, setCopied] = useState(false)

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Batch selection state
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchTesting, setBatchTesting] = useState(false)

  // Edit dialog state
  const [editServer, setEditServer] = useState<MCPServer | null>(null)
  const [editDesc, setEditDesc] = useState("")
  const [editTransport, setEditTransport] = useState("stdio")
  const [editCommand, setEditCommand] = useState("")
  const [editArgs, setEditArgs] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const [editEnv, setEditEnv] = useState("")
  const [editHeaders, setEditHeaders] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState("")

  // Tools dialog state
  const [toolsServer, setToolsServer] = useState<string | null>(null)
  const [toolsList, setToolsList] = useState<ServerToolInfo[]>([])
  const [toolsLoading, setToolsLoading] = useState(false)
  const [toolsUpdating, setToolsUpdating] = useState<string | null>(null)

  const loadServers = useCallback(async () => {
    try {
      const data = await fetchServers()
      setServers(data)
      setError("")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load servers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login")
      return
    }
    loadServers()
  }, [router, loadServers])

  // ─── Test All ───
  const [testingAll, setTestingAll] = useState(false)
  
  const handleTestAll = async () => {
    if (servers.length === 0) return
    setTestingAll(true)
    let updated = false
    try {
      for (const s of servers) {
        try {
          await testServer(s.name)
          updated = true
        } catch {
          updated = true // even if it errors we might have updated status
        }
      }
    } finally {
      if (updated) {
        await loadServers()
      }
      setTestingAll(false)
    }
  }

  // ─── Batch Selection ───
  const toggleSelect = (name: string) => {
    setSelectedServers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const deselectAll = () => {
    setSelectedServers(new Set())
  }

  // ─── Batch Delete ───
  const handleBatchDelete = async () => {
    setBatchDeleting(true)
    try {
      for (const name of selectedServers) {
        try {
          await deleteServer(name)
        } catch {
          // continue deleting rest
        }
      }
      setSelectedServers(new Set())
      setBatchDeleteOpen(false)
      await loadServers()
    } finally {
      setBatchDeleting(false)
    }
  }

  // ─── Batch Test ───
  const handleBatchTest = async () => {
    setBatchTesting(true)
    try {
      for (const name of selectedServers) {
        try {
          await testServer(name)
        } catch {
          // continue
        }
      }
      await loadServers()
    } finally {
      setBatchTesting(false)
    }
  }

  // Filtered servers
  const filteredServers = useMemo(() => {
    let result = servers
    if (filterTransport !== "all") {
      result = result.filter((s) => s.transport === filterTransport)
    }
    if (filterStatus !== "all") {
      result = result.filter((s) => (s.status || "registered") === filterStatus)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.transport.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.command && s.command.toLowerCase().includes(q)) ||
          (s.url && s.url.toLowerCase().includes(q)) ||
          (s.args && s.args.some((a) => a.toLowerCase().includes(q)))
      )
    }
    return result
  }, [servers, search, filterTransport, filterStatus])

  // Batch selection helpers (depend on filteredServers)
  const selectAllFiltered = useCallback(() => {
    setSelectedServers(new Set(filteredServers.map((s) => s.name)))
  }, [filteredServers])

  const isAllFilteredSelected =
    filteredServers.length > 0 && filteredServers.every((s) => selectedServers.has(s.name))

  const toggleSelectAll = useCallback(() => {
    if (isAllFilteredSelected) deselectAll()
    else selectAllFiltered()
  }, [isAllFilteredSelected, selectAllFiltered])

  // Unique values for filters
  const transportOptions = useMemo(() => [...new Set(servers.map((s) => s.transport))], [servers])
  const statusOptions = useMemo(() => [...new Set(servers.map((s) => s.status || "registered"))], [servers])

  // Reset page when search or view mode changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, viewMode, filterTransport, filterStatus])

  // Clear selection on filter/search change
  useEffect(() => {
    setSelectedServers(new Set())
  }, [search, filterTransport, filterStatus])

  // Paged servers
  const pageSize = viewMode === "card" ? PAGE_SIZE_CARD : PAGE_SIZE_LIST
  const totalPages = Math.max(1, Math.ceil(filteredServers.length / pageSize))
  const pagedServers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredServers.slice(start, start + pageSize)
  }, [filteredServers, currentPage, pageSize])

  // ─── Reset Add dialog ───
  function resetAddDialog() {
    setAddName(""); setAddDesc(""); setAddCommand(""); setAddArgs(""); setAddUrl("")
    setAddEnv(""); setAddHeaders(""); setAddError(""); setAddTransport("stdio")
    setJsonInput(""); setJsonResult(null); setJsonError(""); setAddTab("form")
  }

  // ─── Open Edit dialog ───
  function openEditDialog(s: MCPServer) {
    setEditServer(s)
    setEditDesc(s.description || "")
    setEditTransport(s.transport)
    setEditCommand(s.command || "")
    setEditArgs((s.args || []).join(" "))
    setEditUrl(s.url || "")
    setEditEnv(s.env && Object.keys(s.env).length > 0 ? JSON.stringify(s.env, null, 2) : "")
    setEditHeaders(s.headers && Object.keys(s.headers).length > 0 ? JSON.stringify(s.headers, null, 2) : "")
    setEditError("")
  }

  // ─── Add Server (Form mode) ───
  async function handleAdd() {
    setAddError("")
    setAddSubmitting(true)
    try {
      const data: Parameters<typeof registerServer>[0] = {
        name: addName, transport: addTransport, description: addDesc || undefined,
      }
      if (addTransport === "stdio") {
        data.command = addCommand
        data.args = addArgs ? addArgs.split(/\s+/) : []
        if (addEnv.trim()) {
          try { data.env = JSON.parse(addEnv) } catch { throw new Error("ENV 格式错误，请使用 JSON") }
        }
      } else {
        data.url = addUrl
        if (addHeaders.trim()) {
          try { data.headers = JSON.parse(addHeaders) } catch { throw new Error("Headers 格式错误，请使用 JSON") }
        }
      }
      await registerServer(data)
      setAddOpen(false)
      resetAddDialog()
      await loadServers()
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add server")
    } finally {
      setAddSubmitting(false)
    }
  }

  // ─── Edit Server ───
  async function handleEdit() {
    if (!editServer) return
    setEditError("")
    setEditSubmitting(true)
    try {
      const data: Parameters<typeof updateServer>[1] = {
        name: editServer.name, transport: editTransport, description: editDesc,
      }
      if (editTransport === "stdio") {
        data.command = editCommand
        data.args = editArgs ? editArgs.split(/\s+/) : []
        if (editEnv.trim()) {
          try { data.env = JSON.parse(editEnv) } catch { throw new Error("ENV 格式错误，请使用 JSON") }
        }
      } else {
        data.url = editUrl
        if (editHeaders.trim()) {
          try { data.headers = JSON.parse(editHeaders) } catch { throw new Error("Headers 格式错误，请使用 JSON") }
        }
      }
      await updateServer(editServer.name, data)
      setEditServer(null)
      await loadServers()
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update server")
    } finally {
      setEditSubmitting(false)
    }
  }

  // ─── Add Server (JSON mode) ───
  async function handleJsonImport() {
    setJsonError(""); setJsonResult(null); setJsonSubmitting(true)
    try {
      const data = JSON.parse(jsonInput)
      const result = await importServers(data)
      setJsonResult(result)
      if (result.imported.length > 0) await loadServers()
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : "无效的 JSON 格式")
    } finally {
      setJsonSubmitting(false)
    }
  }

  // ─── Delete Server ───
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteServer(deleteTarget)
      setDeleteTarget(null)
      await loadServers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete server")
    } finally {
      setDeleteLoading(false)
    }
  }

  // ─── Export ───
  async function handleExport() {
    try {
      const data = await exportServers(exportFormat)
      setExportData(JSON.stringify(data, null, 2))
    } catch (err: unknown) {
      setExportData(err instanceof Error ? err.message : "Export failed")
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(exportData)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Tools Dialog ───
  async function openToolsDialog(name: string) {
    setToolsServer(name)
    setToolsLoading(true)
    setToolsList([])
    try {
      const res = await fetchServerTools(name)
      setToolsList(res.tools)
    } catch {
      setToolsList([])
    } finally {
      setToolsLoading(false)
    }
  }

  async function handleToggleTool(toolName: string, currentDisabled: boolean) {
    if (!toolsServer) return
    setToolsUpdating(toolName)
    try {
      const newDisabled = currentDisabled
        ? toolsList.filter(t => t.disabled && t.name !== toolName).map(t => t.name)
        : [...toolsList.filter(t => t.disabled).map(t => t.name), toolName]
      await updateDisabledTools(toolsServer, newDisabled)
      setToolsList(prev => prev.map(t => t.name === toolName ? { ...t, disabled: !t.disabled } : t))
    } catch {
      // ignore
    } finally {
      setToolsUpdating(null)
    }
  }

  // ─── Exposure Toggle ───
  const [exposureUpdating, setExposureUpdating] = useState<string | null>(null)

  async function handleToggleExposure(name: string, currentExposure: string) {
    setExposureUpdating(name)
    const newExposure = currentExposure === "direct" ? "progressive" : "direct"
    try {
      await updateServerExposure(name, newExposure as "progressive" | "direct")
      setServers(prev => prev.map(s => s.name === name ? { ...s, exposure: newExposure } : s))
    } catch {
      // ignore
    } finally {
      setExposureUpdating(null)
    }
  }

  // Helper to get server description
  const serverDesc = (s: MCPServer) =>
    s.transport === "stdio"
      ? `${s.command || ""} ${(s.args || []).join(" ")}`.trim()
      : s.url || ""

  // Status dot helper
  const statusDot = (s: MCPServer) => {
    const st = s.status || "registered"
    const colors: Record<string, string> = {
      connected: "bg-emerald-500",
      error: "bg-red-500",
      registered: "bg-gray-400",
    }
    const labels: Record<string, string> = {
      connected: "Connected",
      error: s.error_message ? `Error: ${s.error_message}` : "Error",
      registered: "Registered",
    }
    return (
      <span className="relative flex size-2.5 shrink-0" title={labels[st] || st}>
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-40 ${st === "connected" ? "animate-ping" : ""} ${colors[st] || "bg-gray-400"}`} />
        <span className={`relative inline-flex size-2.5 rounded-full ${colors[st] || "bg-gray-400"}`} />
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Form fields shared between Add and Edit ───
  const renderFormFields = (
    transport: string, setTransport: (v: string) => void,
    command: string, setCommand: (v: string) => void,
    args: string, setArgs: (v: string) => void,
    url: string, setUrl: (v: string) => void,
    env: string, setEnv: (v: string) => void,
    headers: string, setHeaders: (v: string) => void,
  ) => (
    <>
      <div className="flex flex-col gap-2">
        <Label>Transport</Label>
        <Select value={transport} onValueChange={setTransport}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stdio">stdio</SelectItem>
            <SelectItem value="sse">SSE</SelectItem>
            <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {transport === "stdio" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label>Command</Label>
            <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Arguments <span className="text-muted-foreground font-normal">(空格分隔)</span></Label>
            <Input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-github" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Environment Variables <span className="text-muted-foreground font-normal">(JSON, 可选)</span></Label>
            <Textarea value={env} onChange={(e) => setEnv(e.target.value)} placeholder='{"API_KEY": "your-key"}' className="font-mono text-sm min-h-[60px]" />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:8080/sse" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Headers <span className="text-muted-foreground font-normal">(JSON, 可选)</span></Label>
            <Textarea value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder='{"Authorization": "Bearer xxx"}' className="font-mono text-sm min-h-[60px]" />
          </div>
        </>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your registered MCP servers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Test All Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTestAll} 
            disabled={testingAll || servers.length === 0}
          >
            {testingAll ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Zap className="size-4 mr-2" />}
            {testingAll ? "Testing..." : "Test All"}
          </Button>

          {/* Export Dialog */}
          <Dialog open={exportOpen} onOpenChange={(open) => { setExportOpen(open); if (!open) setExportData("") }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="size-4 mr-2" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Export Servers</DialogTitle>
                <DialogDescription>Export as Claude Desktop / VS Code / Generic JSON</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as typeof exportFormat)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">Claude Desktop</SelectItem>
                    <SelectItem value="vscode">VS Code</SelectItem>
                    <SelectItem value="generic">Generic</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleExport}>Generate</Button>
              </div>
              {exportData && (
                <div className="relative">
                  <pre className="text-xs font-mono bg-muted p-3 rounded-md max-h-[300px] overflow-auto whitespace-pre-wrap">
                    {exportData}
                  </pre>
                  <Button size="icon" variant="ghost" className="absolute top-1 right-1 size-7" onClick={handleCopy}>
                    {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Add Server Dialog */}
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetAddDialog() }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Add Server
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add MCP Server</DialogTitle>
                <DialogDescription>通过表单添加单个 Server，或粘贴 JSON 批量导入</DialogDescription>
              </DialogHeader>

              <Tabs value={addTab} onValueChange={(v) => setAddTab(v as "form" | "json")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="form" className="gap-1.5"><FormInput className="size-3.5" />Form</TabsTrigger>
                  <TabsTrigger value="json" className="gap-1.5"><FileJson className="size-3.5" />JSON</TabsTrigger>
                </TabsList>

                {/* Form Mode */}
                <TabsContent value="form" className="mt-4">
                  <div className="flex flex-col gap-4">
                    {addError && (
                      <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0" />{addError}
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <Label>Name</Label>
                      <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="my-mcp-server" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Description <span className="text-muted-foreground font-normal">(可选)</span></Label>
                      <Input value={addDesc} onChange={(e) => setAddDesc(e.target.value)} placeholder="简要描述该 MCP Server 的功能" />
                    </div>
                    {renderFormFields(addTransport, setAddTransport, addCommand, setAddCommand, addArgs, setAddArgs, addUrl, setAddUrl, addEnv, setAddEnv, addHeaders, setAddHeaders)}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button onClick={handleAdd} disabled={addSubmitting || !addName.trim()}>
                      {addSubmitting ? "Adding…" : "Add Server"}
                    </Button>
                  </DialogFooter>
                </TabsContent>

                {/* JSON Mode */}
                <TabsContent value="json" className="mt-4">
                  <div className="flex flex-col gap-4">
                    <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md space-y-1">
                      <p className="font-medium text-foreground">支持以下格式：</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Claude Desktop: <code className="text-[11px]">{`{"mcpServers": {"name": {...}}}`}</code></li>
                        <li>VS Code: <code className="text-[11px]">{`{"mcp": {"servers": {"name": {...}}}}`}</code></li>
                        <li>通用数组: <code className="text-[11px]">{`[{"name": "...", "transport": "..."}]`}</code></li>
                        <li>裸 key: <code className="text-[11px]">{`{"server-name": {"command": "..."}}`}</code></li>
                      </ul>
                    </div>
                    <Textarea
                      value={jsonInput}
                      onChange={(e) => { setJsonInput(e.target.value); setJsonResult(null); setJsonError("") }}
                      placeholder={`{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "your-token" }
    }
  }
}`}
                      className="min-h-[200px] font-mono text-sm"
                    />

                    {jsonError && (
                      <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0" />{jsonError}
                      </div>
                    )}

                    {jsonResult && (
                      <div className="space-y-2">
                        {jsonResult.imported.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-4" />
                            <span>成功导入 {jsonResult.imported.length} 个 Server</span>
                          </div>
                        )}
                        {jsonResult.skipped.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                            <SkipForward className="size-4" />
                            <span>跳过 {jsonResult.skipped.length} 个（已存在）：{jsonResult.skipped.map(s => s.name).join(", ")}</span>
                          </div>
                        )}
                        {jsonResult.errors.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertCircle className="size-4" />
                            <span>失败 {jsonResult.errors.length} 个</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button onClick={handleJsonImport} disabled={jsonSubmitting || !jsonInput.trim()}>
                      {jsonSubmitting ? "Importing…" : "Import"}
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-md">{error}</div>
      )}

      {/* Search + Filters + View Toggle */}
      {servers.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search servers..." className="pl-9" />
            </div>
            <Select value={filterTransport} onValueChange={setFilterTransport}>
              <SelectTrigger className="w-fit min-w-[140px] shrink-0">
                <SelectValue placeholder="Transport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transport</SelectItem>
                {transportOptions.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-fit min-w-[130px] shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex shrink-0 items-center rounded-4xl bg-muted p-1 h-9">
            <button
              onClick={() => setViewMode("card")}
              className={`inline-flex h-full aspect-square items-center justify-center rounded-full transition-all ${
                viewMode === "card"
                  ? "bg-background text-foreground shadow-sm dark:bg-input/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex h-full aspect-square items-center justify-center rounded-full transition-all ${
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm dark:bg-input/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
              }`}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Server Content */}
      {servers.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <ServerIcon className="size-12 opacity-40 mb-4" />
              <p className="font-medium text-base">No servers yet</p>
              <p className="text-sm mt-1">Click &quot;Add Server&quot; to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredServers.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Search className="size-10 opacity-40 mb-3" />
              <p className="font-medium">No matching servers</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        /* ─── Card View ─── */
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pagedServers.map((s) => {
            const isSelected = selectedServers.has(s.name)
            return (
              <Card
                key={s.name}
                className={`group hover:border-primary/40 transition-all hover:shadow-md relative ${
                  isSelected ? "border-primary/50 bg-primary/[0.02] shadow-sm" : ""
                }`}
              >
                {/* Card Checkbox */}
                <div className={`absolute top-3 left-3 z-10 transition-opacity ${
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(s.name)}
                  />
                </div>
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/10 p-2.5 rounded-lg shrink-0 relative">
                      {s.transport === "stdio" ? <Terminal className="size-4 text-primary" /> : <Globe className="size-4 text-primary" />}
                      <span className="absolute -top-0.5 -right-0.5">{statusDot(s)}</span>
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{s.name}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[11px]">{s.transport}</Badge>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <Switch
                                  checked={(s.exposure || "progressive") === "direct"}
                                  onCheckedChange={() => handleToggleExposure(s.name, s.exposure || "progressive")}
                                  disabled={exposureUpdating === s.name}
                                  className="h-4 w-7 data-[state=checked]:bg-amber-500 [&>span]:size-3 [&>span]:data-[state=checked]:translate-x-3"
                                />
                                <Zap className={`size-3 ${(s.exposure || "progressive") === "direct" ? "text-amber-500" : "text-muted-foreground/40"}`} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="text-xs">{(s.exposure || "progressive") === "direct" ? "Direct: 工具直接暴露给 AI" : "Progressive: 通过 meta-tool 发现"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => openToolsDialog(s.name)} title="Manage Tools">
                      <Wrench className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => openEditDialog(s)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(s.name)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {s.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{s.description}</p>
                  )}
                  <p className="font-mono text-xs text-muted-foreground/60 truncate" title={serverDesc(s)}>
                    {serverDesc(s)}
                  </p>
                  {s.env && Object.keys(s.env).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.keys(s.env).slice(0, 3).map((k) => (
                        <Badge key={k} variant="secondary" className="text-[10px] font-mono">{k}</Badge>
                      ))}
                      {Object.keys(s.env).length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">+{Object.keys(s.env).length - 3}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      {viewMode === "list" && filteredServers.length > 0 ? (
        /* ─── List View ─── */
        <Card className="shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllFilteredSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead className="w-[100px]">Transport</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Env</TableHead>
                <TableHead className="w-[90px]">Exposure</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedServers.map((s) => (
                <TableRow key={s.name} className={`group ${selectedServers.has(s.name) ? "bg-primary/[0.03]" : ""}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedServers.has(s.name)}
                      onCheckedChange={() => toggleSelect(s.name)}
                    />
                  </TableCell>
                  <TableCell className="font-semibold text-sm">
                    <span className="flex items-center gap-2">
                      {statusDot(s)}
                      {s.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px]">{s.transport}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                    {s.description || <span className="font-mono text-muted-foreground/50" title={serverDesc(s)}>{serverDesc(s)}</span>}
                  </TableCell>
                  <TableCell>
                    {s.env && Object.keys(s.env).length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{Object.keys(s.env).length} vars</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={(s.exposure || "progressive") === "direct"}
                        onCheckedChange={() => handleToggleExposure(s.name, s.exposure || "progressive")}
                        disabled={exposureUpdating === s.name}
                        className="h-4 w-7 data-[state=checked]:bg-amber-500 [&>span]:size-3 [&>span]:data-[state=checked]:translate-x-3"
                      />
                      <span className={`text-[11px] ${(s.exposure || "progressive") === "direct" ? "text-amber-500 font-medium" : "text-muted-foreground"}`}>
                        {(s.exposure || "progressive") === "direct" ? "Direct" : "Progressive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => openToolsDialog(s.name)} title="Manage Tools">
                        <Wrench className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(s)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(s.name)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {/* ─── Pagination ─── */}
      {filteredServers.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredServers.length)} of {filteredServers.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="icon"
                className="size-8 text-xs"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Edit Dialog ─── */}
      <Dialog open={!!editServer} onOpenChange={(open) => { if (!open) setEditServer(null) }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Server: {editServer?.name}</DialogTitle>
            <DialogDescription>修改 MCP Server 的配置</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {editError && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />{editError}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Description <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="简要描述该 MCP Server 的功能" />
            </div>
            {renderFormFields(editTransport, setEditTransport, editCommand, setEditCommand, editArgs, setEditArgs, editUrl, setEditUrl, editEnv, setEditEnv, editHeaders, setEditHeaders)}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditServer(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editSubmitting}>
              {editSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm Dialog ─── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Batch Delete Confirm Dialog ─── */}
      <Dialog open={batchDeleteOpen} onOpenChange={(open) => { if (!open && !batchDeleting) setBatchDeleteOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Delete Servers</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the following {selectedServers.size} server(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[200px] overflow-y-auto space-y-1 py-2">
            {[...selectedServers].map((name) => (
              <div key={name} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-muted/50">
                <ServerIcon className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{name}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteOpen(false)} disabled={batchDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleBatchDelete} disabled={batchDeleting}>
              {batchDeleting ? <><Loader2 className="size-4 mr-2 animate-spin" />Deleting…</> : `Delete ${selectedServers.size} Servers`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Tools Management Dialog ─── */}
      <Dialog open={!!toolsServer} onOpenChange={(open) => { if (!open) setToolsServer(null) }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="size-4 text-primary" />
              Tools: {toolsServer}
            </DialogTitle>
            <DialogDescription>
              Toggle tools on/off. Disabled tools will not be exposed to the AI client.
            </DialogDescription>
          </DialogHeader>
          {toolsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : toolsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Wrench className="size-8 opacity-20 mb-3" />
              <p className="text-sm">No tools found or connection failed</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-2">
                <span>{toolsList.filter(t => !t.disabled).length} / {toolsList.length} tools enabled</span>
              </div>
              {toolsList.map(tool => (
                <div
                  key={tool.name}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    tool.disabled 
                      ? "bg-muted/30 border-border/30 opacity-60" 
                      : "bg-background border-border/50 hover:border-primary/30"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-mono font-medium truncate ${tool.disabled ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {tool.name}
                      </span>
                    </div>
                    {tool.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tool.description}</p>
                    )}
                  </div>
                  <Button
                    variant={tool.disabled ? "outline" : "default"}
                    size="sm"
                    className={`h-7 px-2.5 gap-1.5 shrink-0 text-xs ${
                      tool.disabled 
                        ? "text-muted-foreground" 
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                    disabled={toolsUpdating === tool.name}
                    onClick={() => handleToggleTool(tool.name, tool.disabled)}
                  >
                    {toolsUpdating === tool.name ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : tool.disabled ? (
                      <><EyeOff className="size-3" /> Off</>
                    ) : (
                      <><Eye className="size-3" /> On</>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Floating Batch Action Bar ─── */}
      {selectedServers.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background/95 backdrop-blur-md border shadow-lg rounded-xl px-4 py-2.5 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <span className="text-sm font-semibold px-1">
            {selectedServers.size} selected
          </span>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Button variant="ghost" size="sm" className="h-8 text-xs px-3" onClick={selectAllFiltered}>
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 px-3"
            onClick={handleBatchTest}
            disabled={batchTesting || batchDeleting}
          >
            {batchTesting ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            {batchTesting ? "Testing..." : "Test"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 text-xs gap-1.5 px-3"
            onClick={() => setBatchDeleteOpen(true)}
            disabled={batchTesting || batchDeleting}
          >
            <Trash2 className="size-3" />
            Delete
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground ml-1" onClick={deselectAll}>
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
