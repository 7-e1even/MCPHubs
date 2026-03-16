"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Server, Activity, Terminal, Globe, Copy, Check, Wrench, Shield, Cpu, MemoryStick } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchHealth, fetchServers, getSettings, isLoggedIn, type MCPServer, type HealthResponse } from "@/lib/api"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")
  const [apiKey, setApiKey] = useState("")

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login")
      return
    }
    setOrigin(window.location.origin)
    async function load() {
      try {
        const [h, s] = await Promise.all([fetchHealth(), fetchServers()])
        setHealth(h)
        setServers(s)
      } catch {
        try {
          const h = await fetchHealth()
          setHealth(h)
        } catch { /* ignore */ }
      }
      try {
        const settings = await getSettings()
        setApiKey(settings.api_key ?? "")
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [router])

  const stdioServers = servers.filter((s) => s.transport === "stdio")
  const remoteServers = servers.filter((s) => s.transport !== "stdio")

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const mcpUrl = `${origin}/mcp`

  // Build config objects, include auth headers if api_key is set
  const buildServerEntry = () => {
    const entry: Record<string, unknown> = {
      type: "streamable-http",
      url: mcpUrl,
    }
    if (apiKey) {
      entry.headers = { Authorization: `Bearer ${apiKey}` }
    }
    return entry
  }

  const cursorConfig = JSON.stringify({
    mcpServers: {
      mcphubs: buildServerEntry()
    }
  }, null, 2)

  const claudeConfig = JSON.stringify({
    mcpServers: {
      mcphubs: buildServerEntry()
    }
  }, null, 2)

  const vscodeConfig = JSON.stringify({
    mcp: {
      servers: {
        mcphubs: buildServerEntry()
      }
    }
  }, null, 2)

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
        <Separator />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ─── Sleek Stats Bar ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20 border rounded-xl px-6 py-4 shadow-sm mt-2">
        <div className="flex flex-1 items-center gap-4">
          <div className="bg-primary/10 p-2.5 rounded-lg shrink-0">
            <Server className="size-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">Total Servers</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold leading-none">{health?.servers_count ?? servers.length}</p>
              <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">Registered</span>
            </div>
          </div>
        </div>
        
        <Separator orientation="vertical" className="h-10 hidden sm:block opacity-50" />
        <Separator orientation="horizontal" className="w-full block sm:hidden opacity-50" />
        
        <div className="flex flex-1 items-center gap-4">
          <div className="bg-emerald-500/10 p-2.5 rounded-lg shrink-0">
            <Terminal className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">Stdio Servers</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold leading-none text-emerald-600 dark:text-emerald-400">{stdioServers.length}</p>
              <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">Local Process</span>
            </div>
          </div>
        </div>
        
        <Separator orientation="vertical" className="h-10 hidden sm:block opacity-50" />
        <Separator orientation="horizontal" className="w-full block sm:hidden opacity-50" />
        
        <div className="flex flex-1 items-center gap-4">
          <div className="bg-indigo-500/10 p-2.5 rounded-lg shrink-0">
            <Globe className="size-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">Remote Servers</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold leading-none text-indigo-600 dark:text-indigo-400">{remoteServers.length}</p>
              <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">SSE / HTTP</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ─── Quick Connect (Left, 2 cols) ─── */}
        <Card className="lg:col-span-2 h-full border-border/60 shadow-sm bg-gradient-to-br from-card to-muted/20 overflow-hidden relative">
          <div className="absolute right-0 top-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-background border shadow-sm p-2.5 rounded-xl">
              <Terminal className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">Quick Connect</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                复制以下 JSON 配置到对应工具即刻接入所有 MCP Server
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <Tabs defaultValue="cursor" className="w-full">
            <TabsList className="inline-flex h-9 items-center justify-start rounded-lg bg-muted/50 p-1 text-muted-foreground w-max max-w-full overflow-x-auto">
              <TabsTrigger value="cursor" className="px-3 text-[13px] whitespace-nowrap">Cursor / Windsurf</TabsTrigger>
              <TabsTrigger value="claude" className="px-3 text-[13px] whitespace-nowrap">Claude Desktop</TabsTrigger>
              <TabsTrigger value="vscode" className="px-3 text-[13px] whitespace-nowrap">VS Code</TabsTrigger>
            </TabsList>
            <div className="mt-5">
              <TabsContent value="cursor" className="space-y-3 m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  打开 <Badge variant="secondary" className="font-normal rounded-md shadow-sm">Settings → Features → MCP Servers</Badge>，
                  点击 <Badge variant="outline" className="font-normal rounded-md bg-background shadow-sm">+ Add new MCP Server</Badge>，
                  选择 <Badge variant="secondary" className="font-normal rounded-md shadow-sm">type: url</Badge>，粘贴以下 JSON：
                </p>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-primary/0 rounded-xl opacity-0 group-hover:opacity-100 transition duration-500 blur"></div>
                  <pre className="relative p-4 rounded-xl bg-zinc-950/90 backdrop-blur border border-zinc-800/50 shadow-inner text-zinc-300 text-[13px] font-mono overflow-x-auto leading-relaxed">
                    {cursorConfig}
                  </pre>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2.5 right-2.5 h-8 w-8 text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors rounded-lg"
                    onClick={() => copyToClipboard(cursorConfig, "cursor")}
                  >
                    {copiedKey === "cursor" ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="claude" className="space-y-3 m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  将以下内容添加到 <Badge variant="secondary" className="font-mono font-normal rounded-md shadow-sm">claude_desktop_config.json</Badge> 文件中：
                </p>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-primary/0 rounded-xl opacity-0 group-hover:opacity-100 transition duration-500 blur"></div>
                  <pre className="relative p-4 rounded-xl bg-zinc-950/90 backdrop-blur border border-zinc-800/50 shadow-inner text-zinc-300 text-[13px] font-mono overflow-x-auto leading-relaxed">
                    {claudeConfig}
                  </pre>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2.5 right-2.5 h-8 w-8 text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors rounded-lg"
                    onClick={() => copyToClipboard(claudeConfig, "claude")}
                  >
                    {copiedKey === "claude" ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="vscode" className="space-y-3 m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  将以下内容添加到 <Badge variant="secondary" className="font-mono font-normal rounded-md shadow-sm">.vscode/settings.json</Badge> 中：
                </p>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-primary/0 rounded-xl opacity-0 group-hover:opacity-100 transition duration-500 blur"></div>
                  <pre className="relative p-4 rounded-xl bg-zinc-950/90 backdrop-blur border border-zinc-800/50 shadow-inner text-zinc-300 text-[13px] font-mono overflow-x-auto leading-relaxed">
                    {vscodeConfig}
                  </pre>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2.5 right-2.5 h-8 w-8 text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors rounded-lg"
                    onClick={() => copyToClipboard(vscodeConfig, "vscode")}
                  >
                    {copiedKey === "vscode" ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

        {/* ─── System Info (Right, 1 col) ─── */}
        <Card className="h-full shadow-sm border-border/50 bg-gradient-to-br from-card to-card/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              System Info
            </CardTitle>
            <CardDescription className="text-xs">
              Gateway and runtime status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between bg-background/50 rounded-lg p-3 border border-border/50">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {health?.status === "ok" ? "Operational" : (health?.status || "Unknown")}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-background/50 rounded-lg p-3 border border-border/50">
              <span className="text-xs font-medium text-muted-foreground">Gateway</span>
              <span className="text-sm font-semibold">{health?.name || "MCPHubs"}</span>
            </div>

            <div className="flex items-center justify-between bg-background/50 rounded-lg p-3 border border-border/50">
              <span className="text-xs font-medium text-muted-foreground">Mode</span>
              <Badge variant="secondary" className="text-[11px] font-medium capitalize">
                {health?.exposure_mode || "progressive"}
              </Badge>
            </div>

            <div className="flex items-center justify-between bg-background/50 rounded-lg p-3 border border-border/50">
              <span className="text-xs font-medium text-muted-foreground">Total Tools</span>
              <div className="flex items-center gap-1.5">
                <Wrench className="size-3.5 text-muted-foreground" />
                <span className="text-sm font-bold">{health?.total_tools ?? 0}</span>
              </div>
            </div>

            {/* CPU Usage */}
            <div className="bg-background/50 rounded-lg p-3 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">CPU</span>
                </div>
                <span className={`text-sm font-bold ${
                  (health?.cpu_percent ?? 0) > 80 ? 'text-red-500' :
                  (health?.cpu_percent ?? 0) > 50 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {health?.cpu_percent ?? 0}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (health?.cpu_percent ?? 0) > 80 ? 'bg-red-500' :
                    (health?.cpu_percent ?? 0) > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(health?.cpu_percent ?? 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory Usage */}
            <div className="bg-background/50 rounded-lg p-3 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MemoryStick className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Memory</span>
                </div>
                <span className={`text-sm font-bold ${
                  (health?.memory_percent ?? 0) > 80 ? 'text-red-500' :
                  (health?.memory_percent ?? 0) > 50 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {health?.memory_used_mb ?? 0} MB
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (health?.memory_percent ?? 0) > 80 ? 'bg-red-500' :
                    (health?.memory_percent ?? 0) > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(health?.memory_percent ?? 0, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {health?.memory_used_mb ?? 0} / {health?.memory_total_mb ?? 0} MB
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Server List ─── */}
      <Card className="shadow-sm border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Registered Servers
            </CardTitle>
            <CardDescription className="text-xs">
              Active MCP servers in your hub
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push("/servers")}>
            View All
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="bg-muted/50 p-4 rounded-full mb-4">
                <Server className="size-8 opacity-40 text-primary" />
              </div>
              <p className="font-medium text-sm">No servers registered</p>
              <p className="text-xs mt-1">Go to MCP Servers page to add your first server.</p>
            </div>
          ) : (
            <div className="divide-y">
              {servers.slice(0, 5).map((server) => (
                <div
                  key={server.name}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <div className="bg-primary/10 p-2.5 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                      {server.transport === "stdio" ? (
                        <Terminal className="size-4 text-primary" />
                      ) : (
                        <Globe className="size-4 text-primary" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate text-foreground/90">{server.name}</p>
                        <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-medium tracking-wide bg-secondary/50">
                          {server.transport.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-mono bg-muted/40 rounded px-1.5 py-0.5 w-fit max-w-full">
                        {server.transport === "stdio"
                          ? `${server.command || ""} ${(server.args || []).join(" ")}`.trim()
                          : server.url || ""}
                      </p>
                      {server.description && (
                        <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">
                          {server.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {servers.length > 5 && (
                <div className="p-3 text-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => router.push("/servers")}>
                  <p className="text-xs font-medium text-muted-foreground">
                    View {servers.length - 5} more servers
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
