"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Check, Eye, EyeOff, AlertCircle, BrainCircuit } from "lucide-react"
import { getSettings, updateSetting, isLoggedIn } from "@/lib/api"

export default function LLMSettingsPage() {
  const router = useRouter()

  const [settingsLoading, setSettingsLoading] = useState(true)
  const [llmBaseUrl, setLlmBaseUrl] = useState("")
  const [llmBaseUrlOrig, setLlmBaseUrlOrig] = useState("")
  const [llmApiKey, setLlmApiKey] = useState("")
  const [llmApiKeyOrig, setLlmApiKeyOrig] = useState("")
  const [llmApiKeyVisible, setLlmApiKeyVisible] = useState(false)
  const [llmModel, setLlmModel] = useState("")
  const [llmModelOrig, setLlmModelOrig] = useState("")
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState("")
  const [llmSuccess, setLlmSuccess] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return }
    loadSettings()
  }, [router])

  async function loadSettings() {
    try {
      const data = await getSettings()
      const baseUrl = data.llm_base_url ?? ""
      const lKey = data.llm_api_key ?? ""
      const model = data.llm_model ?? ""
      setLlmBaseUrl(baseUrl); setLlmBaseUrlOrig(baseUrl)
      setLlmApiKey(lKey); setLlmApiKeyOrig(lKey)
      setLlmModel(model); setLlmModelOrig(model)
    } catch { /* ignore */ } finally {
      setSettingsLoading(false)
    }
  }

  const llmChanged = llmBaseUrl !== llmBaseUrlOrig || llmApiKey !== llmApiKeyOrig || llmModel !== llmModelOrig

  async function handleLlmSave() {
    setLlmError(""); setLlmSuccess(false); setLlmLoading(true)
    try {
      await Promise.all([
        llmBaseUrl !== llmBaseUrlOrig ? updateSetting("llm_base_url", llmBaseUrl) : null,
        llmApiKey !== llmApiKeyOrig ? updateSetting("llm_api_key", llmApiKey) : null,
        llmModel !== llmModelOrig ? updateSetting("llm_model", llmModel) : null,
      ])
      setLlmSuccess(true)
      setLlmBaseUrlOrig(llmBaseUrl); setLlmApiKeyOrig(llmApiKey); setLlmModelOrig(llmModel)
      setTimeout(() => setLlmSuccess(false), 3000)
    } catch (err: unknown) {
      setLlmError(err instanceof Error ? err.message : "Failed to save LLM config")
    } finally {
      setLlmLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="shadow-sm border-border/50">
        <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BrainCircuit className="size-4 text-primary" />
            LLM Configuration
          </CardTitle>
          <CardDescription className="text-xs">
            Configure an OpenAI-compatible API to auto-generate descriptions for your MCP servers.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {settingsLoading ? (
            <div className="space-y-4 max-w-xl">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-xl">
              {llmError && (
                <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-center gap-2 border border-destructive/20">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="font-medium">{llmError}</span>
                </div>
              )}
              {llmSuccess && (
                <div className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2 flex items-center gap-2 border border-emerald-500/20">
                  <Check className="size-4 shrink-0" />
                  <span className="font-medium">LLM configuration saved successfully</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="llm-base-url" className="text-sm font-medium">Base URL</Label>
                  <Input
                    id="llm-base-url"
                    type="text"
                    value={llmBaseUrl}
                    onChange={(e) => { setLlmBaseUrl(e.target.value); setLlmSuccess(false) }}
                    placeholder="https://api.openai.com/v1"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    OpenAI-compatible endpoint (e.g. OpenAI, DeepSeek, Ollama, etc.)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="llm-api-key" className="text-sm font-medium">API Key</Label>
                  <div className="relative">
                    <Input
                      id="llm-api-key"
                      type={llmApiKeyVisible ? "text" : "password"}
                      value={llmApiKey}
                      onChange={(e) => { setLlmApiKey(e.target.value); setLlmSuccess(false) }}
                      placeholder="sk-..."
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
                      onClick={() => setLlmApiKeyVisible(!llmApiKeyVisible)}
                    >
                      {llmApiKeyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="llm-model" className="text-sm font-medium">Model</Label>
                  <Input
                    id="llm-model"
                    type="text"
                    value={llmModel}
                    onChange={(e) => { setLlmModel(e.target.value); setLlmSuccess(false) }}
                    placeholder="gpt-4o-mini"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Defaults to gpt-4o-mini if left empty
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleLlmSave} disabled={llmLoading || !llmChanged} className="w-full sm:w-auto">
                  {llmLoading ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
