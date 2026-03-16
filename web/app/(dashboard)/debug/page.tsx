"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Bug,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CircleDot,
  Wrench,
  Terminal,
  Globe,
  ArrowRight,
  RotateCw,
  Zap,
  ChevronRight,
  Server as ServerIcon,
} from "lucide-react"
import {
  fetchServers,
  testServer,
  callServerTool,
  isLoggedIn,
  type MCPServer,
  type TestResult,
  type ToolInfo,
  type CallToolResult,
} from "@/lib/api"
import { useRouter } from "next/navigation"

type ServerTestState = {
  status: "idle" | "testing" | "success" | "error"
  result?: TestResult
}

export default function DebugPage() {
  const router = useRouter()
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [testStates, setTestStates] = useState<Record<string, ServerTestState>>({})
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)
  const [toolArgs, setToolArgs] = useState("{}")
  const [callResult, setCallResult] = useState<CallToolResult | null>(null)
  const [calling, setCalling] = useState(false)
  const [testingAll, setTestingAll] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return }
    fetchServers().then(s => { setServers(s); setLoading(false) }).catch(() => setLoading(false))
  }, [router])

  const doTest = useCallback(async (name: string) => {
    setTestStates(prev => ({ ...prev, [name]: { status: "testing" } }))
    try {
      const r = await testServer(name)
      setTestStates(prev => ({
        ...prev,
        [name]: { status: r.connected ? "success" : "error", result: r },
      }))
    } catch (e) {
      setTestStates(prev => ({
        ...prev,
        [name]: {
          status: "error",
          result: { status: "error", connected: false, elapsed_ms: 0, tools_count: 0, tools: [], error: String(e) },
        },
      }))
    }
  }, [])

  const testAll = useCallback(async () => {
    setTestingAll(true)
    for (const s of servers) {
      await doTest(s.name)
    }
    setTestingAll(false)
  }, [servers, doTest])

  const selectServer = (name: string) => {
    setSelectedServer(name)
    setSelectedTool(null)
    setCallResult(null)
    setToolArgs("{}")
  }

  const doCallTool = async () => {
    if (!selectedServer || !selectedTool) return
    setCalling(true)
    setCallResult(null)
    try {
      const parsed = JSON.parse(toolArgs)
      const r = await callServerTool(selectedServer, selectedTool.name, parsed)
      setCallResult(r)
    } catch (e) {
      setCallResult({
        status: "error",
        elapsed_ms: 0,
        tool_name: selectedTool.name,
        error: String(e),
      })
    }
    setCalling(false)
  }

  const getStatusIcon = (state?: ServerTestState) => {
    if (!state || state.status === "idle") return <CircleDot className="size-4 text-muted-foreground" />
    if (state.status === "testing") return <Loader2 className="size-4 text-amber-500 animate-spin" />
    if (state.status === "success") return <CheckCircle2 className="size-4 text-emerald-500" />
    return <XCircle className="size-4 text-red-500" />
  }

  const selectedState = selectedServer ? testStates[selectedServer] : undefined
  const selectedTools = selectedState?.result?.tools ?? []

  // Stats
  const tested = Object.values(testStates).filter(s => s.status !== "idle" && s.status !== "testing").length
  const passed = Object.values(testStates).filter(s => s.status === "success").length
  const failed = Object.values(testStates).filter(s => s.status === "error").length

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 mt-2" />
        <Separator />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="size-6 text-primary" />
            MCP Debug
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            测试每个 MCP Server 的连接状态，验证工具列表，手动调用工具。
          </p>
        </div>
        <Button
          onClick={testAll}
          disabled={testingAll || servers.length === 0}
          className="gap-2 shadow-sm"
        >
          {testingAll ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Test All ({servers.length})
        </Button>
      </div>



      <div className="grid gap-6 md:grid-cols-12 h-[calc(100vh-220px)] min-h-[600px]">
        {/* ─── Left: Server List ─── */}
        <Card className="md:col-span-4 xl:col-span-3 shadow-sm flex flex-col overflow-hidden border-border/50">
          <CardHeader className="pb-3 border-b bg-muted/10 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ServerIcon className="size-4" />
                Servers
              </CardTitle>
              {tested > 0 && (
                <div className="flex items-center gap-2.5 text-[11px] bg-background/50 border rounded-full px-2 py-0.5">
                  <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    {passed}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                    <XCircle className="size-3" />
                    {failed}
                  </span>
                </div>
              )}
            </div>
            <CardDescription className="text-xs mt-1.5">
              点击 Server 查看详情，点击 ▶ 测试连接
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1 bg-muted/5">
            {servers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Globe className="size-10 opacity-20 mb-3" />
                <p className="text-sm">No servers registered</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {servers.map(s => {
                  const state = testStates[s.name]
                  const isSelected = selectedServer === s.name
                  return (
                    <div
                      key={s.name}
                      className={`flex items-start gap-3 p-3 cursor-pointer transition-all ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"}`}
                      onClick={() => selectServer(s.name)}
                    >
                      <div className="mt-1 shrink-0">{getStatusIcon(state)}</div>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <span className="text-sm font-medium truncate text-foreground/90">{s.name}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 bg-background/50 hidden sm:inline-flex">
                              {s.transport === "stdio" ? <Terminal className="size-2.5 mr-0.5" /> : <Globe className="size-2.5 mr-0.5" />}
                              {s.transport.toUpperCase()}
                            </Badge>
                          </div>
                          
                          {/* Right aligned metrics to prevent height change */}
                          <div className="flex items-center gap-1.5 shrink-0 justify-end w-24">
                            {state?.result && (
                              <>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-mono">
                                  <Clock className="size-2.5" />
                                  {state.result.elapsed_ms}ms
                                </span>
                                {state.result.tools_count > 0 && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-mono bg-muted/30 px-1 rounded-sm">
                                    <Wrench className="size-2.5" />
                                    {state.result.tools_count}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 mt-0.5"
                        disabled={state?.status === "testing"}
                        onClick={(e) => { e.stopPropagation(); doTest(s.name) }}
                      >
                        {state?.status === "testing" ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Right: Detail Panel ─── */}
        <Card className="md:col-span-8 xl:col-span-9 shadow-sm flex flex-col overflow-hidden border-border/50">
          <CardHeader className="pb-3 border-b bg-muted/10 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Terminal className="size-4 text-primary" />
                {selectedServer ? selectedServer : "Workspace"}
              </CardTitle>
              {selectedServer && selectedState?.result && (
                <div className="flex items-center gap-2">
                  {selectedState.result.connected ? (
                    <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                      <CheckCircle2 className="size-3 mr-1" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20">
                      <XCircle className="size-3 mr-1" /> Failed
                    </Badge>
                  )}
                </div>
              )}
            </div>
            {selectedServer && selectedState?.result && (
              <CardDescription className="text-xs flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1"><Clock className="size-3" /> {selectedState.result.elapsed_ms}ms</span>
                {selectedState.result.tools_count > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-3" />
                    <span className="flex items-center gap-1"><Wrench className="size-3" /> {selectedState.result.tools_count} tools available</span>
                  </>
                )}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="p-0 flex flex-col sm:flex-row flex-1 overflow-hidden">
            {!selectedServer ? (
              <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-8">
                <div className="bg-muted/30 p-4 rounded-full mb-4">
                  <ArrowRight className="size-8 opacity-40 text-primary" />
                </div>
                <p className="font-medium">Select a server</p>
                <p className="text-xs mt-1">Choose a server from the left panel to view details and test tools.</p>
              </div>
            ) : !selectedState?.result ? (
              <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-8">
                <div className="bg-muted/30 p-4 rounded-full mb-4">
                  <Play className="size-8 opacity-40 text-primary" />
                </div>
                <p className="font-medium">Not tested yet</p>
                <p className="text-xs mt-1 mb-4">Test connection to fetch available tools.</p>
                <Button className="gap-2 shadow-sm" onClick={() => doTest(selectedServer)}>
                  <Play className="size-4" /> Test Connection
                </Button>
              </div>
            ) : selectedState.result.error && !selectedState.result.connected ? (
              <div className="flex flex-col flex-1 p-6">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
                    <XCircle className="size-4" /> Connection Failed
                  </h3>
                  <div className="bg-red-500/5 rounded-md p-3 max-h-[400px] overflow-auto">
                    <pre className="text-xs text-red-800/80 dark:text-red-300/80 whitespace-pre-wrap font-mono">
                      {selectedState.result.error}
                    </pre>
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => doTest(selectedServer)}>
                    <RotateCw className="size-3.5" /> Retry Connection
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
                {/* Tools List Column */}
                <div className="w-full sm:w-1/4 min-w-[200px] max-w-[280px] border-r border-border/50 flex flex-col overflow-hidden bg-background">
                  <div className="p-3 px-4 border-b bg-muted/5 shrink-0 flex items-center h-[45px]">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Tools</h3>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {selectedTools.map(tool => {
                      const isSelected = selectedTool?.name === tool.name
                      return (
                        <div
                          key={tool.name}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-background shadow-sm border-border/60 relative z-10" 
                              : "border-transparent hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            setSelectedTool(tool)
                            setCallResult(null)
                            // Auto-generate example args
                            const schema = tool.inputSchema as { properties?: Record<string, { type?: string }> }
                            if (schema?.properties) {
                              const example: Record<string, string> = {}
                              Object.keys(schema.properties).forEach(k => { example[k] = "" })
                              setToolArgs(JSON.stringify(example, null, 2))
                            } else {
                              setToolArgs("{}")
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold font-mono truncate ${isSelected ? "text-primary" : "text-foreground/90"}`}>
                              {tool.name}
                            </span>
                          </div>
                          {tool.description && (
                            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                              {tool.description}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tool Execute Column */}
                <div className="flex-1 flex flex-col overflow-hidden bg-background border-l border-border/50 -ml-[1px]">
                  {!selectedTool ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-8 bg-muted/5">
                      <Wrench className="size-8 opacity-20 mb-3" />
                      <p className="text-sm">Select a tool from the list to test it</p>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 overflow-hidden z-0">
                      <div className="p-3 px-4 border-b bg-background shrink-0 flex items-center justify-between h-[45px]">
                        <div>
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <span className="font-mono text-foreground">{selectedTool.name}</span>
                          </h4>
                        </div>
                        <Button
                          size="sm"
                          className="gap-2 shadow-sm"
                          disabled={calling}
                          onClick={doCallTool}
                        >
                          {calling ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
                          Execute Tool
                        </Button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-5">
                        {/* Schema & Args */}
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex justify-between">
                              Arguments
                              <span className="text-[10px] text-muted-foreground font-normal normal-case">JSON Format</span>
                            </label>
                            <Textarea
                              value={toolArgs}
                              onChange={e => setToolArgs(e.target.value)}
                              className="font-mono text-xs min-h-[160px] bg-background shadow-inner resize-y border-border/50 focus-visible:ring-primary/20"
                              placeholder='{"key": "value"}'
                              spellCheck={false}
                            />
                          </div>

                          {selectedTool.inputSchema && Object.keys(selectedTool.inputSchema).length > 0 && (
                            <div className="space-y-2 flex flex-col">
                              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                Input Schema
                              </label>
                              <div className="flex-1 bg-zinc-950 rounded-md border border-zinc-800 shadow-inner overflow-hidden flex flex-col">
                                <pre className="p-3 text-zinc-300 text-[11px] font-mono overflow-auto flex-1">
                                  {JSON.stringify(selectedTool.inputSchema, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Result Panel */}
                        {callResult && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center justify-between">
                              Execution Result
                              {callResult.status === "ok" && (
                                <span className="text-[10px] normal-case bg-background px-2 py-0.5 rounded-full border shadow-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-2.5" /> {callResult.elapsed_ms}ms
                                </span>
                              )}
                            </label>
                            
                            <div className={`rounded-lg border shadow-sm overflow-hidden ${callResult.status === "error" ? "border-red-500/30" : "border-emerald-500/30"}`}>
                              <div className={`px-3 py-2 border-b flex items-center justify-between ${callResult.status === "error" ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                                <span className={`text-xs font-semibold flex items-center gap-1.5 ${callResult.status === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                                  {callResult.status === "error" ? <XCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                                  {callResult.status === "error" ? "Execution Error" : "Success"}
                                </span>
                                {callResult.status === "error" && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="size-2.5" /> {callResult.elapsed_ms}ms
                                  </span>
                                )}
                              </div>
                              <div className="bg-background relative">
                                <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto leading-relaxed">
                                  {callResult.error
                                    ? <span className="text-red-600 dark:text-red-400">{callResult.error}</span>
                                    : callResult.result
                                      ? callResult.result.map(r => r.text || r.data || "").join("\n")
                                      : <span className="text-muted-foreground italic">(empty response)</span>}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
