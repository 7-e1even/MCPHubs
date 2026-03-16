"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Check, Eye, EyeOff, AlertCircle, CloudDownload, RefreshCw } from "lucide-react"
import { getSettings, updateSetting, syncModelScope, isLoggedIn } from "@/lib/api"

export default function IntegrationsPage() {
  const router = useRouter()

  const [settingsLoading, setSettingsLoading] = useState(true)
  const [msToken, setMsToken] = useState("")
  const [msTokenOrig, setMsTokenOrig] = useState("")
  const [msTokenVisible, setMsTokenVisible] = useState(false)
  const [msLoading, setMsLoading] = useState(false)
  const [msError, setMsError] = useState("")
  const [msSuccess, setMsSuccess] = useState(false)
  const [msSyncing, setMsSyncing] = useState(false)
  const [msSyncResult, setMsSyncResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return }
    loadSettings()
  }, [router])

  async function loadSettings() {
    try {
      const data = await getSettings()
      const msT = data.modelscope_token ?? ""
      setMsToken(msT); setMsTokenOrig(msT)
    } catch { /* ignore */ } finally {
      setSettingsLoading(false)
    }
  }

  const msTokenChanged = msToken !== msTokenOrig

  async function handleMsTokenSave() {
    setMsError(""); setMsSuccess(false); setMsLoading(true)
    try {
      await updateSetting("modelscope_token", msToken)
      setMsSuccess(true); setMsTokenOrig(msToken)
      setTimeout(() => setMsSuccess(false), 3000)
    } catch (err: unknown) {
      setMsError(err instanceof Error ? err.message : "Failed to save token")
    } finally {
      setMsLoading(false)
    }
  }

  async function handleMsSync() {
    setMsError(""); setMsSyncResult(null); setMsSyncing(true)
    try {
      const result = await syncModelScope()
      setMsSyncResult({
        imported: result.imported?.length ?? 0,
        skipped: result.skipped?.length ?? 0,
        errors: result.errors?.length ?? 0,
      })
    } catch (err: unknown) {
      setMsError(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setMsSyncing(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="shadow-sm border-border/50">
        <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CloudDownload className="size-4 text-primary" />
            ModelScope MCP 对接
          </CardTitle>
          <CardDescription className="text-xs">
            配置 ModelScope SDK Token，一键同步 MCP 广场中的远程服务到 McpHub。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {settingsLoading ? (
            <div className="space-y-4 max-w-xl">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-xl">
              {msError && (
                <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-center gap-2 border border-destructive/20">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="font-medium">{msError}</span>
                </div>
              )}
              {msSuccess && (
                <div className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2 flex items-center gap-2 border border-emerald-500/20">
                  <Check className="size-4 shrink-0" />
                  <span className="font-medium">Token saved successfully</span>
                </div>
              )}
              {msSyncResult && (
                <div className="rounded-md bg-primary/10 text-primary text-sm px-3 py-2 flex items-center gap-2 border border-primary/20">
                  <Check className="size-4 shrink-0" />
                  <span className="font-medium">
                    同步完成：导入 {msSyncResult.imported} 个，跳过 {msSyncResult.skipped} 个
                    {msSyncResult.errors > 0 && `，失败 ${msSyncResult.errors} 个`}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ms-token" className="text-sm font-medium">SDK Token</Label>
                  <div className="relative">
                    <Input
                      id="ms-token"
                      type={msTokenVisible ? "text" : "password"}
                      value={msToken}
                      onChange={(e) => { setMsToken(e.target.value); setMsSuccess(false); setMsSyncResult(null) }}
                      placeholder="Your ModelScope SDK Token"
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
                      onClick={() => setMsTokenVisible(!msTokenVisible)}
                    >
                      {msTokenVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    前往 <a href="https://modelscope.cn/my/myaccesstoken" target="_blank" rel="noreferrer" className="underline text-primary">ModelScope 个人设置</a> 获取 SDK Token
                  </p>
                </div>

                <div className="bg-muted/50 rounded-md p-3 border text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">工作原理：</p>
                  <p>保存 Token 后点击「同步」，将自动从 ModelScope MCP 广场拉取你已启用的 MCP Server 并注册到 McpHub。</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleMsTokenSave} disabled={msLoading || !msTokenChanged} className="w-full sm:w-auto">
                  {msLoading ? "Saving…" : "Save Token"}
                </Button>
                <Button onClick={handleMsSync} disabled={msSyncing || !msTokenOrig} variant="outline" className="w-full sm:w-auto gap-1.5">
                  <RefreshCw className={`size-3.5 ${msSyncing ? "animate-spin" : ""}`} />
                  {msSyncing ? "Syncing…" : "同步 MCP 服务"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
