"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  ScrollText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Activity,
  AlertCircle,
  Zap,
} from "lucide-react"
import {
  fetchAuditLogs,
  fetchAuditStats,
  fetchServers,
  isLoggedIn,
  type AuditLog,
  type AuditLogsResponse,
  type AuditStats,
} from "@/lib/api"

export default function LogsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLogsResponse | null>(null)
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [serverNames, setServerNames] = useState<string[]>([])

  // Filters
  const [page, setPage] = useState(1)
  const [filterServer, setFilterServer] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterTool, setFilterTool] = useState("")

  // Detail dialog
  const [detail, setDetail] = useState<AuditLog | null>(null)

  const loadLogs = useCallback(async () => {
    try {
      const data = await fetchAuditLogs({
        page,
        page_size: 20,
        server_name: filterServer !== "all" ? filterServer : undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        tool_name: filterTool || undefined,
      })
      setLogs(data)
    } catch { /* ignore */ }
  }, [page, filterServer, filterStatus, filterTool])

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return }
    async function init() {
      try {
        const [s, servers] = await Promise.all([fetchAuditStats(), fetchServers()])
        setStats(s)
        setServerNames(servers.map((sv) => sv.name))
      } catch { /* ignore */ }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (!loading) loadLogs()
  }, [loading, loadLogs])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [filterServer, filterStatus, filterTool])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString()
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="hover:border-emerald-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats?.success ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="hover:border-red-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <XCircle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats?.errors ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={filterTool}
            onChange={(e) => setFilterTool(e.target.value)}
            placeholder="Search tool name..."
            className="pl-9"
          />
        </div>
        <Select value={filterServer} onValueChange={setFilterServer}>
          <SelectTrigger className="w-fit min-w-[160px]">
            <SelectValue placeholder="All Servers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Servers</SelectItem>
            {serverNames.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-fit min-w-[130px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      <Card className="shadow-sm">
        {!logs || logs.items.length === 0 ? (
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <ScrollText className="size-12 opacity-40 mb-4" />
              <p className="font-medium text-base">No logs yet</p>
              <p className="text-sm mt-1">Audit logs will appear here when MCP tools are called via the progressive proxy.</p>
            </div>
          </CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Time</TableHead>
                  <TableHead className="w-[140px]">Server</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[90px]">Duration</TableHead>
                  <TableHead className="w-[100px] text-right">Arguments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.items.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetail(log)}
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {formatTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">{log.server_name}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.tool_name}</TableCell>
                    <TableCell>
                      {log.status === "success" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px]">
                          <CheckCircle2 className="size-3 mr-1" />OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[11px]">
                          <XCircle className="size-3 mr-1" />Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Zap className="size-3" />
                        {formatDuration(log.duration_ms)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[80px] inline-block">
                        {log.arguments ? (log.arguments.length > 30 ? log.arguments.slice(0, 30) + "…" : log.arguments) : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {logs.total_pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {logs.page} of {logs.total_pages} ({logs.total} total)
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={page >= logs.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="size-4" />
              Call Detail
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Server</p>
                  <Badge variant="outline">{detail.server_name}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tool</p>
                  <p className="font-mono font-medium">{detail.tool_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  {detail.status === "success" ? (
                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                      <CheckCircle2 className="size-3 mr-1" />Success
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="size-3 mr-1" />Error
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <p className="flex items-center gap-1">
                    <Clock className="size-3" />{formatDuration(detail.duration_ms)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Time</p>
                  <p className="font-mono text-xs">{formatTime(detail.created_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Arguments</p>
                <pre className="text-xs font-mono bg-muted p-3 rounded-md max-h-[200px] overflow-auto whitespace-pre-wrap break-all">
                  {detail.arguments ? (() => { try { return JSON.stringify(JSON.parse(detail.arguments), null, 2) } catch { return detail.arguments } })() : "—"}
                </pre>
              </div>

              {detail.status === "error" && detail.error_message && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Error</p>
                  <div className="rounded-md bg-destructive/10 text-destructive text-xs px-3 py-2 flex items-start gap-2 border border-destructive/20">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span className="break-all">{detail.error_message}</span>
                  </div>
                </div>
              )}

              {detail.result_preview && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Result Preview</p>
                  <pre className="text-xs font-mono bg-muted p-3 rounded-md max-h-[200px] overflow-auto whitespace-pre-wrap break-all">
                    {detail.result_preview}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
