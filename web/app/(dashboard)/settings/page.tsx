"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Check, Shield, Eye, EyeOff, AlertCircle } from "lucide-react"
import { getSettings, updateSetting, isLoggedIn } from "@/lib/api"

export default function GeneralSettingsPage() {
  const router = useRouter()

  const [apiKey, setApiKey] = useState("")
  const [apiKeyOriginal, setApiKeyOriginal] = useState("")
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [akLoading, setAkLoading] = useState(false)
  const [akError, setAkError] = useState("")
  const [akSuccess, setAkSuccess] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return }
    loadSettings()
  }, [router])

  async function loadSettings() {
    try {
      const data = await getSettings()
      const key = data.api_key ?? ""
      setApiKey(key); setApiKeyOriginal(key)
    } catch {
      setApiKey(""); setApiKeyOriginal("")
    } finally {
      setSettingsLoading(false)
    }
  }

  const apiKeyChanged = apiKey !== apiKeyOriginal

  async function handleApiKeySave() {
    setAkError(""); setAkSuccess(false); setAkLoading(true)
    try {
      await updateSetting("api_key", apiKey)
      setAkSuccess(true); setApiKeyOriginal(apiKey)
      setTimeout(() => setAkSuccess(false), 3000)
    } catch (err: unknown) {
      setAkError(err instanceof Error ? err.message : "Failed to save API key")
    } finally {
      setAkLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="shadow-sm border-border/50">
        <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            API Key Authentication
          </CardTitle>
          <CardDescription className="text-xs">
            Secure your MCP endpoints. Leave blank to disable authentication.
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
              {akError && (
                <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-center gap-2 border border-destructive/20">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="font-medium">{akError}</span>
                </div>
              )}
              {akSuccess && (
                <div className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2 flex items-center gap-2 border border-emerald-500/20">
                  <Check className="size-4 shrink-0" />
                  <span className="font-medium">API Key saved successfully</span>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="api-key" className="text-sm font-medium">Global API Key</Label>
                  <div className="relative">
                    <Input
                      id="api-key"
                      type={apiKeyVisible ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setAkSuccess(false) }}
                      placeholder="e.g. sk-my-secret-key"
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
                      onClick={() => setApiKeyVisible(!apiKeyVisible)}
                    >
                      {apiKeyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="bg-muted/50 rounded-md p-3 border text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Client Connection Usage:</p>
                  <p>Clients connecting to your Hub must provide this key in their HTTP headers:</p>
                  <code className="block mt-2 bg-background p-2 rounded border font-mono text-foreground">
                    Authorization: Bearer {"<your-key>"}
                  </code>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleApiKeySave} disabled={akLoading || !apiKeyChanged} className="w-full sm:w-auto">
                  {akLoading ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
