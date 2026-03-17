"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Check, KeyRound, AlertCircle, Eye, EyeOff, Copy, RefreshCw, Ticket } from "lucide-react"
import { changePassword, getSettings, updateSetting, isLoggedIn } from "@/lib/api"

export default function SecuritySettingsPage() {
  const router = useRouter()

  // Password state
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)

  // Admin Token state
  const [adminToken, setAdminToken] = useState("")
  const [adminTokenOriginal, setAdminTokenOriginal] = useState("")
  const [tokenVisible, setTokenVisible] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState("")
  const [tokenSuccess, setTokenSuccess] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return }
    loadSettings()
  }, [router])

  async function loadSettings() {
    try {
      const data = await getSettings()
      const token = data.admin_token ?? ""
      setAdminToken(token)
      setAdminTokenOriginal(token)
    } catch {
      // ignore
    } finally {
      setSettingsLoading(false)
    }
  }

  // ─── Password ───
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError("")
    setPwSuccess(false)

    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match")
      return
    }

    setPwLoading(true)
    try {
      await changePassword(oldPassword, newPassword)
      setPwSuccess(true)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setPwLoading(false)
    }
  }

  // ─── Admin Token ───
  const tokenChanged = adminToken !== adminTokenOriginal

  function generateToken() {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const token = "mch_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")
    setAdminToken(token)
    setTokenSuccess(false)
  }

  async function handleTokenSave() {
    setTokenError(""); setTokenSuccess(false); setTokenLoading(true)
    try {
      await updateSetting("admin_token", adminToken)
      setTokenSuccess(true)
      setAdminTokenOriginal(adminToken)
      setTimeout(() => setTokenSuccess(false), 3000)
    } catch (err: unknown) {
      setTokenError(err instanceof Error ? err.message : "Failed to save token")
    } finally {
      setTokenLoading(false)
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(adminToken)
  }

  return (
    <div className="grid gap-6">
      {/* Admin Token Card */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Ticket className="size-4 text-primary" />
            Admin Token
          </CardTitle>
          <CardDescription className="text-xs">
            A static token for external tools to access the management API without login. Use as <code className="bg-muted px-1 py-0.5 rounded text-[11px]">Bearer &lt;token&gt;</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {settingsLoading ? (
            <div className="space-y-4 max-w-xl">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-xl">
              {tokenError && (
                <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-center gap-2 border border-destructive/20">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="font-medium">{tokenError}</span>
                </div>
              )}
              {tokenSuccess && (
                <div className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2 flex items-center gap-2 border border-emerald-500/20">
                  <Check className="size-4 shrink-0" />
                  <span className="font-medium">Admin Token saved</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-token" className="text-sm font-medium">Token</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="admin-token"
                        type={tokenVisible ? "text" : "password"}
                        value={adminToken}
                        onChange={(e) => { setAdminToken(e.target.value); setTokenSuccess(false) }}
                        placeholder="Click Generate or enter a custom token"
                        className="pr-10 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
                        onClick={() => setTokenVisible(!tokenVisible)}
                      >
                        {tokenVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={copyToken} title="Copy">
                      <Copy className="size-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={generateToken} title="Generate random token">
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-md p-3 border text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Usage:</p>
                  <code className="block bg-background p-2 rounded border font-mono text-foreground">
                    curl -H &quot;Authorization: Bearer &lt;token&gt;&quot; http://host:8000/api/servers
                  </code>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleTokenSave} disabled={tokenLoading || !tokenChanged} className="w-full sm:w-auto">
                  {tokenLoading ? "Saving…" : "Save Token"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Account Password
          </CardTitle>
          <CardDescription className="text-xs">
            Update your administrative login password
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4 max-w-xl">
            {pwError && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-center gap-2 border border-destructive/20">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-medium">{pwError}</span>
              </div>
            )}
            {pwSuccess && (
              <div className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2 flex items-center gap-2 border border-emerald-500/20">
                <Check className="size-4 shrink-0" />
                <span className="font-medium">Password updated successfully</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="old-password">Current Password</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>
              
              <Separator className="my-2 bg-border/50" />
              
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={pwLoading} className="w-full sm:w-auto">
                {pwLoading ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
